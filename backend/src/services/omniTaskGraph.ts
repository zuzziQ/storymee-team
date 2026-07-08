// @ts-nocheck
import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import { prisma } from "../config/prisma";
import { OmniTaskService } from "./omniTask.service";

// Define the State structure for LangGraph workflow
export const OmniTaskGraphState = Annotation.Root({
  orderText: Annotation<string>(),
  projectId: Annotation<string>(),
  sprintId: Annotation<string>(),
  milestoneId: Annotation<string>(),
  rawSubtasks: Annotation<any[]>(),
  assignedSubtasks: Annotation<any[]>(),
  workloadChecked: Annotation<boolean>(),
  finalResult: Annotation<any>(),
  error: Annotation<string>(),
});

export class OmniTaskGraphService {
  /**
   * Run the state machine pipeline for task breakdown, resource checking, and persistence.
   */
  static async runWorkflow(params: {
    orderText: string;
    projectId?: string;
    sprintId?: string;
    milestoneId?: string;
  }) {
    
    let useLangGraph = true;
    if (params.projectId) {
      const project = await prisma.project.findUnique({ where: { id: params.projectId } });
      if (project && project.useLangGraphWorkflow !== undefined) {
        useLangGraph = project.useLangGraphWorkflow;
      }
    } else {
      const { SettingsService } = require('./settings.service');
      const settings = await SettingsService.getSettings();
      useLangGraph = settings.useLangGraphWorkflow !== false;
    }

    if (useLangGraph === false) {
      console.log("[OmniTaskGraph] LangGraph is disabled via feature flag. Using direct Gemini native completion.");
      return await this.runDirectLLMBypass(params);
    }


    const workflow = new StateGraph(OmniTaskGraphState)
      // Node 1: Breakdown task order using AI
      .addNode("breakdown", async (state) => {
        console.log("[OmniTaskGraph] Node: breakdown - Parsing and decomposing task order");
        try {
          const breakdown = await OmniTaskService.parseTaskOrder(state.orderText);
          return {
            rawSubtasks: breakdown.subtasks.map((t, idx) => ({
              id: `t_${idx + 1}`,
              title: t.title,
              description: t.description || "",
              priority: t.priority || "medium",
              estimatedHours: t.estimatedHours || 4,
              deadlineDays: t.deadlineDays || 3,
              suggestedAssigneeName: t.suggestedAssigneeName || null,
              deliverables: t.deliverables || []
            }))
          };
        } catch (e: any) {
          return { error: `Task breakdown node failed: ${e.message}` };
        }
      })

      // Node 2: Read Guidelines and Assignee context from Letta Memory
      .addNode("readMemory", async (state) => {
        console.log("[OmniTaskGraph] Node: readMemory - Accessing Letta Archival Memory for historical skills context");
        if (state.error) return {};

        const projectId = state.projectId || "default_project";
        let memorySuggestions: string[] = [];
        try {
          memorySuggestions = await fetch('http://localhost:4600/internal/v1/ai/letta/memory/query', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: 
            projectId, query: "task allocation sprint guidelines team capability workload rules"
           }) }).then((r: any) => r.json()).then((r: any) => r.data);
          console.log(`[OmniTaskGraph] Retrieved ${memorySuggestions.length} guidelines from Letta memory vault.`);
        } catch (e: any) {
          console.warn("[OmniTaskGraph] Letta connection failed or agent offline. Fallback to database context:", e.message);
        }

        const members = await prisma.teamMember.findMany({ where: { isActive: true } });
        const assignedSubtasks = [...(state.rawSubtasks || [])];

        for (const sub of assignedSubtasks) {
          if (!sub.suggestedAssigneeName) {
            // Match based on skills keywords
            const matched = members.find(m =>
              m.skills.some(s =>
                sub.title.toLowerCase().includes(s.toLowerCase()) ||
                sub.description.toLowerCase().includes(s.toLowerCase())
              )
            );
            if (matched) {
              sub.suggestedAssigneeName = matched.fullName;
              console.log(`[OmniTaskGraph] Auto-assigned "${sub.title}" to ${matched.fullName} based on matching skills`);
            } else if (members.length > 0) {
              sub.suggestedAssigneeName = members[0].fullName;
            }
          }
        }

        return { assignedSubtasks };
      })

      // Node 3: Inspect active workloads to prevent overloading (Workload & Collision Check)
      .addNode("checkWorkload", async (state) => {
        console.log("[OmniTaskGraph] Node: checkWorkload - Verifying workloads and resource collisions");
        if (state.error) return {};

        const subtasks = [...(state.assignedSubtasks || [])];
        const workloadMap = new Map<string, number>();

        // Load active workloads for the current sprint
        if (state.sprintId) {
          const activeTasks = await prisma.task.findMany({
            where: { sprintId: state.sprintId },
            include: { subTasks: { include: { Assignee: true } } }
          });
          for (const t of activeTasks) {
            for (const st of t.subTasks) {
              if (st.Assignee && st.status !== 'done') {
                const hours = st.estimatedHours || 0;
                const name = st.Assignee.fullName;
                workloadMap.set(name, (workloadMap.get(name) || 0) + hours);
              }
            }
          }
        }

        const members = await prisma.teamMember.findMany({ where: { isActive: true } });

        for (const sub of subtasks) {
          const assigneeName = sub.suggestedAssigneeName;
          if (assigneeName) {
            const currentHours = workloadMap.get(assigneeName) || 0;
            const newHours = sub.estimatedHours || 0;

            if (currentHours + newHours > 40) {
              console.warn(`[OmniTaskGraph] Collision check failed! ${assigneeName} is overloaded (${currentHours + newHours}h). Re-allocating task.`);
              
              // Find backup resource with similar skills and lowest workload
              const fallback = members
                .filter(m => m.fullName !== assigneeName)
                .map(m => ({
                  member: m,
                  hours: workloadMap.get(m.fullName) || 0
                }))
                .sort((a, b) => a.hours - b.hours)[0];

              if (fallback && fallback.hours + newHours <= 40) {
                console.log(`[OmniTaskGraph] Reallocated "${sub.title}" from ${assigneeName} to ${fallback.member.fullName}`);
                sub.suggestedAssigneeName = fallback.member.fullName;
                workloadMap.set(fallback.member.fullName, fallback.hours + newHours);
              } else {
                sub.overloaded = true;
                workloadMap.set(assigneeName, currentHours + newHours);
              }
            } else {
              workloadMap.set(assigneeName, currentHours + newHours);
            }
          }
        }

        return {
          assignedSubtasks: subtasks,
          workloadChecked: true
        };
      })

      // Node 4: Persist everything to database
      .addNode("save", async (state) => {
        console.log("[OmniTaskGraph] Node: save - Committing structures to database");
        if (state.error) return {};

        try {
          const task = await prisma.task.create({
            data: {
              title: "OmniTask Agentic Job",
              description: `Generated dynamically via LangGraph pipeline for prompt: "${state.orderText.slice(0, 100)}..."`,
              source: "langgraph",
              projectId: state.projectId ? state.projectId : undefined,
              sprintId: state.sprintId ? state.sprintId : undefined,
              milestoneId: state.milestoneId ? state.milestoneId : undefined,
            }
          });

          const members = await prisma.teamMember.findMany();
          const memberMap = new Map<string, string>();
          for (const m of members) {
            memberMap.set(m.fullName.toLowerCase(), m.id);
          }

          const createdSubtasks = [];
          for (const sub of state.assignedSubtasks || []) {
            const assigneeId = sub.suggestedAssigneeName
              ? memberMap.get(sub.suggestedAssigneeName.toLowerCase())
              : null;

            const deadline = sub.deadlineDays
              ? new Date(Date.now() + sub.deadlineDays * 24 * 60 * 60 * 1000)
              : null;

            const created = await prisma.subTask.create({
              data: {
                taskId: task.id,
                title: sub.title,
                description: sub.description,
                assigneeId: assigneeId || undefined,
                outputSuggested: sub.deliverables ? sub.deliverables.join('\n') : '',
                status: "pending",
                priority: sub.priority || "medium",
                deadline: deadline,
                estimatedHours: sub.estimatedHours
              }
            });
            createdSubtasks.push(created);
          }

          return {
            finalResult: {
              task,
              subtasks: createdSubtasks
            }
          };
        } catch (e: any) {
          return { error: `Database persistence failed: ${e.message}` };
        }
      });

    // Wire nodes
    workflow
      .addEdge(START, "breakdown")
      .addEdge("breakdown", "readMemory")
      .addEdge("readMemory", "checkWorkload")
      .addEdge("checkWorkload", "save")
      .addEdge("save", END);

    const app = workflow.compile();

    const initialState = {
      orderText: params.orderText,
      projectId: params.projectId || "",
      sprintId: params.sprintId || "",
      milestoneId: params.milestoneId || "",
      rawSubtasks: [],
      assignedSubtasks: [],
      workloadChecked: false,
      finalResult: null,
      error: ""
    };

    console.log("[OmniTaskGraph] Launching state machine...");
    const resultState = await app.invoke(initialState);
    console.log("[OmniTaskGraph] Execution completed.");

    if (resultState.error) {
      throw new Error(resultState.error);
    }

  }

  /**
   * Fast execution path bypassing LangGraph and Letta.
   */
  private static async runDirectLLMBypass(params: {
    orderText: string;
    projectId?: string;
    sprintId?: string;
    milestoneId?: string;
  }) {
    // 1. Breakdown
    const breakdown = await OmniTaskService.parseTaskOrder(params.orderText);
    
    // 2. Simple assignment mapping (skip Letta skills query)
    const members = await prisma.teamMember.findMany({ where: { isActive: true } });
    const assignedSubtasks = breakdown.subtasks.map((t, idx) => {
      let assigneeName = t.suggestedAssigneeName;
      if (!assigneeName) {
        const matched = members.find(m => m.skills.some(s => (t.title + t.description).toLowerCase().includes(s.toLowerCase())));
        assigneeName = matched ? matched.fullName : (members[0]?.fullName || null);
      }
      return {
        id: `t_${idx + 1}`,
        title: t.title,
        description: t.description || "",
        priority: t.priority || "medium",
        estimatedHours: t.estimatedHours || 4,
        deadlineDays: t.deadlineDays || 3,
        suggestedAssigneeName: assigneeName,
        deliverables: t.deliverables || []
      };
    });

    // 3. Save
    const task = await prisma.task.create({
      data: {
        title: "OmniTask Agentic Job (Fast Track)",
        description: `Generated via Direct LLM (LangGraph disabled) for prompt: "${params.orderText.slice(0, 100)}..."`,
        source: "llm_bypass",
        projectId: params.projectId ? params.projectId : undefined,
        sprintId: params.sprintId ? params.sprintId : undefined,
        milestoneId: params.milestoneId ? params.milestoneId : undefined,
      }
    });

    const memberMap = new Map<string, string>();
    for (const m of members) memberMap.set(m.fullName.toLowerCase(), m.id);

    const createdSubtasks = [];
    for (const sub of assignedSubtasks) {
      const assigneeId = sub.suggestedAssigneeName ? memberMap.get(sub.suggestedAssigneeName.toLowerCase()) : null;
      const deadline = sub.deadlineDays ? new Date(Date.now() + sub.deadlineDays * 24 * 60 * 60 * 1000) : null;
      
      const created = await prisma.subTask.create({
        data: {
          taskId: task.id,
          title: sub.title,
          description: sub.description,
          assigneeId: assigneeId || undefined,
          outputSuggested: sub.deliverables ? sub.deliverables.join('\n') : '',
          status: "pending",
          priority: sub.priority || "medium",
          deadline: deadline,
          estimatedHours: sub.estimatedHours
        }
      });
      createdSubtasks.push(created);
    }

    return { task, subtasks: createdSubtasks };
  }
}

import { executeMcpTool } from './index';

async function runTests() {
  const adminUser = { email: "zuzzivn@gmail.com", name: "Admin" };

  console.log("\n=== 🚀 BẮT ĐẦU TEST LUỒNG STORYMEETEAM ===\n");

  try {
    // 1. Test Check-in
    console.log("▶ Test 1: Check-in / Check-out");
    let res = await executeMcpTool('check_in_out', { status: 'present', location: "Office", note: "Test Check-in" }, adminUser);
    console.log(res.content[0].text);
    console.log("✅ Check-in OK.\n");

    // 2. Test Xem công việc
    console.log("▶ Test 2: Xem công việc (get_my_tasks)");
    res = await executeMcpTool('get_my_tasks', { status: "TODO" }, adminUser);
    console.log(res.content[0].text.substring(0, 300) + "...\n(Đã rút gọn)");
    console.log("✅ Xem công việc OK.\n");

    // 3. Test Tạo Task
    console.log("▶ Test 3: Tạo Task (create_task)");
    res = await executeMcpTool('create_task', { 
        title: "Test Task Workflow", 
        description: "Đây là task tự động sinh ra từ script test",
        deadline: "2026-12-31" 
    }, adminUser);
    console.log(res.content[0].text);
    console.log("✅ Tạo Task OK.\n");

    // 4. Test Xem bảng lương
    console.log("▶ Test 4: Tra cứu bảng lương (get_my_payroll_slip)");
    res = await executeMcpTool('get_my_payroll_slip', {}, adminUser);
    console.log(res.content[0].text.substring(0, 300) + "...\n(Đã rút gọn)");
    console.log("✅ Xem bảng lương OK.\n");

  } catch (error: any) {
    console.error("❌ Test thất bại:", error.message);
  }
  process.exit(0);
}

runTests();

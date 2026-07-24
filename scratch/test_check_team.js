const { CoreApiClient } = require('@storymee/api-client');
const apiClient = new CoreApiClient({ baseURL: 'http://localhost:4500' });

async function testCheckTeam() {
  try {
    const json = await apiClient.get("/omnitask/") as any;
    const dbTasks = Array.isArray(json) ? json : (json?.data || []);
    console.log("Tasks found:", dbTasks.length);
    
    let mappedTasks = [];
    dbTasks.forEach((t) => {
      if (Array.isArray(t.subTasks)) {
        t.subTasks.forEach((sub) => {
          mappedTasks.push(sub.title);
        });
      }
    });
    console.log("Mapped tasks:", mappedTasks.length);
  } catch (err) {
    console.error(err);
  }
}
testCheckTeam();

const fetch = require('node-fetch');
async function test() {
  const res = await fetch("http://localhost:3010/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "Tạo sub task cho task STO43-27 : ổn định hệ thống, test các luồng tool calling hoạt động",
      tasks: [],
      projects: [],
      currentUser: { email: "zuzzivn@gmail.com", fullName: "Imam" },
      config: { useCloud: false, useFallback: false }
    })
  });
  console.log(await res.text());
}
test();

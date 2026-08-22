import { chromium } from "@playwright/test";
const EMAIL="e2e-practice-context-patient@test.invalid", PASS="E2ePracticeContext!23";
const LINK_A="cmsytv7zt000834wgp1xlf7m7";
const b = await chromium.launch();
const res = await (await b.newContext()).request.post("http://localhost:3000/api/auth/login",{data:{email:EMAIL,password:PASS}});
const { token, userId } = await res.json();
for (const scheme of ["light","dark"]) {
  const c = await b.newContext({ colorScheme: scheme, viewport:{width:420,height:900} });
  await c.addInitScript(([t,u,s])=>{localStorage.setItem("medscout_token",t);localStorage.setItem("medscout_user_id",u);localStorage.setItem("medscout_theme",s);document.documentElement.setAttribute("data-theme",s);},[token,userId,scheme]);
  const p = await c.newPage();
  await p.goto("http://localhost:5173/patient/practice");
  await p.waitForTimeout(1800);
  await p.screenshot({ path:`/tmp/chooser-${scheme}.png`, fullPage:true });
  await p.goto(`http://localhost:5173/patient/practice/${LINK_A}/messages`);
  await p.waitForTimeout(1500);
  await p.getByRole("button",{name:/Praxis wechseln|Switch practice/i}).click();
  await p.waitForTimeout(700);
  await p.screenshot({ path:`/tmp/switcher-${scheme}.png` });
  await c.close();
}
await b.close();
console.log("screenshots ready");

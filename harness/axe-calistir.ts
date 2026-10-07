import axe from "axe-core";

/** ?axe=1 ile açılan harness sayfalarında erişilebilirlik denetimi yapar; sonucu #axe-sonuc içine JSON olarak yazar. */
export function axeIstenirse() {
  if (!location.search.includes("axe=1")) return;
  setTimeout(async () => {
    const r = await axe.run(document, { resultTypes: ["violations"] });
    const pre = document.createElement("pre");
    pre.id = "axe-sonuc";
    pre.textContent = JSON.stringify(r.violations.map((v) => ({ id: v.id, etki: v.impact, n: v.nodes.length, ornek: v.nodes.slice(0, 3).map((n) => n.html.slice(0, 140)), ozet: v.help })));
    document.body.appendChild(pre);
  }, 3500);
}

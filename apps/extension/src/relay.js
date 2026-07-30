/**
 * SmartLex sahifasida ishlaydi. Sahifa `window.postMessage` orqali yuborgan
 * da'vo ma'lumotini kengaytmага (background) uzatadi. Shuningdek sahifага
 * kengaytma o'rnatilganini bildiradi (tugma holatini yangilash uchun).
 */
(() => {
  window.addEventListener("message", (e) => {
    if (e.source !== window) return;
    const d = e.data;
    if (!d || d.__smartlex !== true || d.type !== "claim" || !d.payload) return;
    chrome.runtime.sendMessage({ type: "lex:store", payload: d.payload }, () => {
      window.postMessage({ __smartlex_ack: true }, "*");
    });
  });

  // Sahifага "kengaytma bor" signalini yuboramiz (bir marta + so'rovga javoban).
  const announce = () => window.postMessage({ __smartlex_ext: true, version: "0.1.0" }, "*");
  window.addEventListener("message", (e) => {
    if (e.source === window && e.data && e.data.__smartlex_ping === true) announce();
  });
  announce();
})();

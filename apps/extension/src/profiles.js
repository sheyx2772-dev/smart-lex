/**
 * Har bir davlat sayti uchun maydon profillari (aniq selektorlar).
 * Har qoida: { get(claim)->qiymat, selectors:[css...], keys:[kalit so'zlar] }.
 * Avval selektorlar sinaladi; topilmasa `keys` bo'yicha umumiy heuristika
 * (fill.js) ishlaydi. Real forma maydon nomlari ma'lum bo'lgach, `selectors`
 * ro'yxatini aniqlashtirib qo'yish kifoya — boshqa joyni o'zgartirmaydi.
 */
self.LEX_PROFILES = {
  "cabinet.sud.uz": [
    { get: (c) => c.tin, selectors: ['input[name*="inn" i]', 'input[name*="stir" i]', 'input[id*="inn" i]', 'input[id*="stir" i]'], keys: ["stir", "инн", "tin", "inn"] },
    { get: (c) => c.debtor, selectors: ['input[name*="respondent" i]', 'input[name*="defendant" i]', 'input[name*="org" i]', 'input[name*="name" i]'], keys: ["nomi", "название", "наименование", "javobgar", "ответчик"] },
    { get: (c) => c.amountNumber, selectors: ['input[name*="amount" i]', 'input[name*="summa" i]', 'input[name*="price" i]', 'input[name*="sum" i]'], keys: ["summa", "сумма", "amount", "qiymat"] },
    { get: (c) => c.court, selectors: ['select[name*="court" i]', 'input[name*="court" i]', 'select[name*="sud" i]'], keys: ["sud", "суд", "court"] },
    { get: (c) => c.contractNumber, selectors: ['input[name*="contract" i]', 'input[name*="dogovor" i]'], keys: ["shartnoma", "договор", "contract"] },
    { get: (c) => c.body, selectors: ['textarea[name*="text" i]', 'textarea[name*="content" i]', 'textarea[name*="claim" i]', "textarea"], keys: ["mazmun", "содержание", "text", "ariza", "da'vo"] },
  ],
  "hybrid.pochta.uz": [
    { get: (c) => c.debtor, selectors: ['input[name*="recipient" i]', 'input[name*="receiver" i]', 'input[name*="to" i]', 'input[name*="name" i]'], keys: ["qabul", "получатель", "recipient", "nomi"] },
    { get: (c) => c.tin, selectors: ['input[name*="inn" i]', 'input[name*="stir" i]'], keys: ["stir", "инн", "tin"] },
    { get: (c) => c.address, selectors: ['input[name*="address" i]', 'textarea[name*="address" i]', 'input[name*="manzil" i]'], keys: ["manzil", "адрес", "address"] },
    { get: (c) => c.body, selectors: ['textarea[name*="text" i]', "textarea"], keys: ["mazmun", "text", "содержание"] },
  ],
  "xarid.uzex.uz": [
    { get: (c) => c.debtor, selectors: ['input[name*="name" i]', 'input[name*="org" i]', 'input[name*="company" i]'], keys: ["nomi", "название", "name"] },
    { get: (c) => c.tin, selectors: ['input[name*="inn" i]', 'input[name*="stir" i]'], keys: ["stir", "инн", "tin"] },
    { get: (c) => c.amountNumber, selectors: ['input[name*="price" i]', 'input[name*="amount" i]', 'input[name*="summa" i]'], keys: ["narx", "цена", "price", "summa"] },
    { get: (c) => c.contractNumber, selectors: ['input[name*="lot" i]', 'input[name*="contract" i]'], keys: ["lot", "лот", "shartnoma", "contract"] },
  ],
};

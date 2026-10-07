// Kullanım: node supabase/tests/yerel/calistir.mjs <test.sql> [en-son-migration-no]
import { testCalistir, yeniVeritabani } from "./ortam.mjs";

const [dosya, son] = process.argv.slice(2);
if (!dosya) { console.error("Kullanım: node supabase/tests/yerel/calistir.mjs <test.sql> [migration-no]"); process.exit(2); }
const db = await yeniVeritabani({ migrationSonu: son ? Number(son) : Infinity });
const rapor = await testCalistir(db, dosya);
console.log(rapor);
const hata = /FAIL/.test(rapor) || /error|hata:/i.test(rapor.split("=== ")[0] ?? "");
process.exit(rapor.includes("RAPORU") && !/FAIL/.test(rapor) ? 0 : 1);

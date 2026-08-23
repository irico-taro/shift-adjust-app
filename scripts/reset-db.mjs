import fs from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), "data");
for (const suffix of ["", "-wal", "-shm", "-journal"]) {
  const file = path.join(dir, `shift.db${suffix}`);
  if (fs.existsSync(file)) {
    fs.rmSync(file);
    console.log(`removed ${file}`);
  }
}
console.log("次回起動時にサンプルデータが再投入されます。");

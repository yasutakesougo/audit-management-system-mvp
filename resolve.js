const fs = require("fs");
const file = process.argv[2];
let content = fs.readFileSync(file, "utf8");
content = content.replace(/<<<<<<< HEAD\n([\s\S]*?)=======\n[\s\S]*?>>>>>>> origin\/main\n/g, "$1");
fs.writeFileSync(file, content);
console.log("Resolved", file);

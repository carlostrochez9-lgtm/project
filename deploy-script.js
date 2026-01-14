const fs = require('fs');
const content = fs.readFileSync('supabase/functions/extract-beo/index.ts', 'utf8');
console.log(JSON.stringify({
  name: "extract-beo",
  slug: "extract-beo",
  verify_jwt: true,
  files: [
    {
      name: "index.ts",
      content: content
    }
  ]
}));

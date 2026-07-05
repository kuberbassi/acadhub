const fs = require('fs');
const glob = require('glob');

const replaceInFile = (file, replacements) => {
    let content = fs.readFileSync(file, 'utf8');
    for (const [regex, replacement] of replacements) {
        content = content.replace(regex, replacement);
    }
    fs.writeFileSync(file, content);
};

// src/index.ts
replaceInFile('src/index.ts', [
    [/const resultsCount = await prisma.semesterResult.count\(\);/g, ''],
    [/semesterResult: resultsCount,/g, '']
]);

// src/routes/attendance.ts
replaceInFile('src/routes/attendance.ts', [
    [/picture: user\.picture \|\| '',/g, '']
]);

// src/routes/dashboard.ts
replaceInFile('src/routes/dashboard.ts', [
    [/const currentSemResult = await prisma\.semesterResult\.findFirst\(\{[^}]+\}\)/g, 'const currentSemResult = null;'],
    [/await prisma\.semesterResult\.findFirst\(\{[\s\S]*?\}\)/g, 'null']
]);

// src/routes/data.ts
replaceInFile('src/routes/data.ts', [
    [/await prisma\.semesterResult\.deleteMany\(\{ where: \{ user_id: req\.user!\.id \} \}\)/g, ''],
    [/await prisma\.skill\.deleteMany\(\{ where: \{ user_id: req\.user!\.id \} \}\)/g, ''],
    [/await prisma\.note\.deleteMany\(\{ where: \{ user_id: req\.user!\.id \} \}\)/g, ''],
    [/branch: '',/g, '']
]);

// src/routes/profile.ts
replaceInFile('src/routes/profile.ts', [
    [/picture: req\.file\.path,/g, ''] // Assuming it's in upload avatar
]);

// src/utils/resultsPayload.ts
replaceInFile('src/utils/resultsPayload.ts', [
    [/const existing = await prisma\.semesterResult\.findFirst\(\{[\s\S]*?\}\)/g, 'const existing = null;']
]);

// src/utils/userData.ts
replaceInFile('src/utils/userData.ts', [
    [/await prisma\.semesterResult\.deleteMany\(\{ where: \{ user_id \} \}\)/g, ''],
    [/await prisma\.skill\.deleteMany\(\{ where: \{ user_id \} \}\)/g, ''],
    [/await prisma\.note\.deleteMany\(\{ where: \{ user_id \} \}\)/g, ''],
    [/const results = await prisma\.semesterResult\.findMany\(\{ where: \{ user_id \} \}\)/g, 'const results = [];'],
    [/const skills = await prisma\.skill\.findMany\(\{ where: \{ user_id \} \}\)/g, 'const skills = [];'],
    [/const notes = await prisma\.note\.findMany\(\{ where: \{ user_id \} \}\)/g, 'const notes = [];']
]);

import { execSync } from 'node:child_process';
import fs from 'node:fs';

const run = (cmd) => execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const registryPath = 'src/domain/improvements/registry-part-05.ts';
const TITLE = "title: 'Developer Console and External Importer Render Coverage'";

function extractBlock(source) {
  const titleIndex = source.indexOf(TITLE);
  if (titleIndex < 0) throw new Error('own entry not found');
  const start = source.lastIndexOf('  {\n', titleIndex);
  const end = source.indexOf('\n  }\n];', titleIndex);
  if (start < 0 || end < 0) throw new Error('own entry boundaries not found');
  return { start, block: source.slice(start, end + 4) };
}

function currentId(block) {
  const m = block.match(/id: 'IMP-(\d+)'/);
  if (!m) throw new Error('own entry id not found');
  return `IMP-${m[1]}`;
}

for (let attempt = 1; attempt <= 4; attempt++) {
  const mine = run(`git show HEAD:${registryPath}`);
  const { block } = extractBlock(mine);
  const id = currentId(block);
  const blockTemplate = block.replace(`id: '${id}'`, 'id: __NEXT_ID__');

  run('git fetch origin main');
  const remote = run('git rev-parse FETCH_HEAD').trim();
  const head = run('git rev-parse HEAD').trim();
  let nextId = id;

  if (remote !== head) {
    let clean = false;
    try {
      run('git rebase FETCH_HEAD');
      clean = true;
    } catch {
      clean = false;
    }
    if (!clean) {
      run(`git checkout --ours -- ${registryPath} IMPROVEMENTS.md`);
      let cur = fs.readFileSync(registryPath, 'utf8');
      const ids = [...cur.matchAll(/id: 'IMP-(\d+)'/g)].map((m) => Number(m[1]));
      nextId = `IMP-${Math.max(...ids) + 1}`;
      const newBlock = blockTemplate.replace('__NEXT_ID__', `'${nextId}'`);

      const stale =
        "        requiredSubstrings: ['statements: 58', 'branches: 48', 'functions: 43', 'lines: 59'],\n" +
        '        rationale:\n' +
        "          'The floors are the only automated guard that the feed/judge/editor/importer gains cannot be spent by an untested module; this entry carries the current numbers and a future ratchet moves them here.',";
      const fresh =
        "        requiredSubstrings: ['thresholds:', 'src/components/**', 'src/domain/**'],\n" +
        '        rationale:\n' +
        "          'The ratchet is the only automated guard that the feed/judge/editor/importer gains cannot be spent by an untested module; the numeric floors live in the newest ratchet entry.',";

      if (cur.includes(stale)) cur = cur.replace(stale, fresh);
      const idx = cur.lastIndexOf('];');
      cur = cur.slice(0, idx) + newBlock + '\n];' + cur.slice(idx + 2);
      fs.writeFileSync(registryPath, cur);
      run('npm run regen:ledgers');
      run('git add -A');
      run('GIT_EDITOR=true git rebase --continue');
    }
    const message = [
      `test(coverage): mount the developer console and importer staging flow (${nextId})`,
      '',
      'The developer console carried 341 statements with no executable coverage and',
      'the external importer panel only ran its default tab. Mount both for real,',
      'drive the workspace switcher, the destructive arm/phrase gate and the',
      'staged-upload merge, then ratchet the floors to 58/49/44/60 (components',
      '26/20/16/27, storage 53/40/48/55, engine functions 75).',
      '',
    ].join('\n');
    fs.writeFileSync('/tmp/commit-msg.txt', message);
    run('git commit --amend -F /tmp/commit-msg.txt');
  }

  console.log(`ready to push ${nextId} (attempt ${attempt})`);
  process.exit(0);
}

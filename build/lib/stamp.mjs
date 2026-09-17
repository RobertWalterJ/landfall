// Landfall — which build is this?
//
// "Is the thing I am looking at the thing you just pushed?" is not a question
// anyone should have to answer by feel. Both publishers use this, so the phone
// PWA and the single-file Artifact carry the SAME version string rather than
// one of them quietly saying "dev".

import { execFileSync } from 'node:child_process';

export function stamp(root) {
  const git = (args) => {
    try { return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim(); }
    catch { return ''; }
  };
  const build = Number(git(['rev-list', '--count', 'HEAD']) || 0) + 1;
  const commit = git(['rev-parse', '--short', 'HEAD']) || 'local';
  const when = new Date().toLocaleString('en-CA', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  });
  return { text: `1.${build} · ${when} · ${commit}`, build, commit };
}

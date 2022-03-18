import fs from 'fs';

(() => {
    let s = fs.readFileSync('/tmp/metrics_local.txt', 'utf8');
    // console.log(`--->`, s.split('\n\n'));
    const n: string[] = [];
    s.split('\n\n').reduce((prev, curr, ) => {
        if (curr.split('Z')[1] != prev.split('Z')[1]) {
            n.push(curr);
        }
        return curr;
    }, '');
    console.log(n.join('\n\n'));
    console.log(n.length);
})()
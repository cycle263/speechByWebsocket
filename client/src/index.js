import { Start, Stop, EmitBuffer } from './main';

const btn = document.getElementById('mytest');
btn.addEventListener('click', () => {
    let t = btn.innerText;
    const isStart = t.includes('Start');
    isStart ? Start() : Stop();
    if (isStart)  
        emitBtn.style.display = 'inline';
    else
        emitBtn.style.display = 'none';
    btn.innerText = isStart ? 'Stop websocket' : 'Start websocket';
});

const emitBtn = document.getElementById('emittest');
emitBtn.addEventListener('click', () => {
    EmitBuffer();
});

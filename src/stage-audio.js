// 행사 화면 효과음: 별도 음원 파일 없이 Web Audio로 합성한다.
let stageAudioContext,noiseCache;

export function getStageAudio(){
 const AudioContext=window.AudioContext||window.webkitAudioContext;
 if(!AudioContext)return null;
 if(!stageAudioContext)stageAudioContext=new AudioContext();
 return stageAudioContext;
}
export function stageAudioRunning(){return stageAudioContext?.state==='running'}

export function playTone(context,destination,frequency,when,duration=.16,type='triangle',volume=.08){
 const oscillator=context.createOscillator(),gain=context.createGain();
 oscillator.type=type;oscillator.frequency.setValueAtTime(frequency,when);
 gain.gain.setValueAtTime(.0001,when);gain.gain.exponentialRampToValueAtTime(volume,when+.025);gain.gain.exponentialRampToValueAtTime(.0001,when+duration);
 oscillator.connect(gain).connect(destination);oscillator.start(when);oscillator.stop(when+duration+.02);
}
function noiseBuffer(context){
 if(noiseCache?.sampleRate===context.sampleRate)return noiseCache;
 const buffer=context.createBuffer(1,context.sampleRate*2,context.sampleRate),data=buffer.getChannelData(0);
 for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
 noiseCache=buffer;return buffer;
}
function playNoise(context,destination,when,duration,{type='lowpass',frequency=900,sweepTo,q=1,volume=.2}={}){
 const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();
 source.buffer=noiseBuffer(context);source.loop=true;
 filter.type=type;filter.Q.value=q;filter.frequency.setValueAtTime(frequency,when);
 if(sweepTo)filter.frequency.exponentialRampToValueAtTime(sweepTo,when+duration);
 gain.gain.setValueAtTime(.0001,when);gain.gain.exponentialRampToValueAtTime(volume,when+.008);gain.gain.exponentialRampToValueAtTime(.0001,when+duration);
 source.connect(filter).connect(gain).connect(destination);source.start(when);source.stop(when+duration+.02);
}
function drone(context,destination,frequency,type='sawtooth',volume=.018){
 const oscillator=context.createOscillator(),gain=context.createGain();
 oscillator.type=type;oscillator.frequency.setValueAtTime(frequency,context.currentTime);gain.gain.setValueAtTime(volume,context.currentTime);
 oscillator.connect(gain).connect(destination);oscillator.start();
 return oscillator;
}
function thump(context,destination,when,frequency,volume){
 const oscillator=context.createOscillator(),gain=context.createGain();
 oscillator.type='sine';oscillator.frequency.setValueAtTime(frequency*1.9,when);oscillator.frequency.exponentialRampToValueAtTime(frequency,when+.07);
 gain.gain.setValueAtTime(.0001,when);gain.gain.exponentialRampToValueAtTime(volume,when+.01);gain.gain.exponentialRampToValueAtTime(.0001,when+.19);
 oscillator.connect(gain).connect(destination);oscillator.start(when);oscillator.stop(when+.21);
}

// 각 사운드트랙은 (context, master, step)으로 한 박을 연주하고 다음 박까지의 ms 간격을 돌려준다.
const SOUNDTRACKS={
 // 두구두구: 점점 빨라지고 커지는 드럼롤
 drumroll(context,master,step){
  const now=context.currentTime,intensity=Math.min(1,.35+step*.05);
  thump(context,master,now,step%2?86:64,.16*intensity+.06);
  playNoise(context,master,now,.12,{type:'lowpass',frequency:1400,sweepTo:420,volume:.13*intensity});
  if(step%4===3)playNoise(context,master,now+.02,.2,{type:'bandpass',frequency:2600,q:.8,volume:.05});
  return Math.max(58,132-step*5);
 },
 // 룰렛: 점점 느려지는 딸깍임과 회전 소음
 ticks(context,master,step){
  const now=context.currentTime;
  playNoise(context,master,now,.035,{type:'bandpass',frequency:2700,q:6,volume:.3});
  playTone(context,master,1180,now,.03,'square',.03);
  if(step%6===0)playTone(context,master,196,now,.22,'sine',.035);
  return Math.min(150,52+step*3.2);
 },
 // 슬롯: 릴 회전음과 규칙적인 금속성 딸깍
 reels(context,master,step){
  const now=context.currentTime;
  playNoise(context,master,now,.1,{type:'highpass',frequency:1800,volume:.09});
  playTone(context,master,step%3?523.25:392,now,.07,'square',.045);
  playTone(context,master,step%3?1046.5:784,now+.02,.05,'triangle',.02);
  return 104;
 },
 // 뽑기공: 통 안에서 공이 튀는 소리
 bounce(context,master,step){
  const now=context.currentTime,scale=[523.25,587.33,698.46,783.99,880,1046.5];
  playTone(context,master,scale[Math.floor(Math.random()*scale.length)],now,.16,'sine',.07);
  playNoise(context,master,now,.05,{type:'bandpass',frequency:900+Math.random()*1600,q:3,volume:.12});
  if(step%5===2)thump(context,master,now,120,.09);
  return 78+Math.random()*90;
 },
 // 카드: 촤르륵 섞이는 소리와 상승 아르페지오
 riffle(context,master,step){
  const now=context.currentTime,scale=[440,523.25,659.25,880,1046.5,1318.5];
  playNoise(context,master,now,.03,{type:'highpass',frequency:2600,sweepTo:5200,volume:.16});
  if(step%3===0)playTone(context,master,scale[Math.min(scale.length-1,Math.floor(step/3))],now,.22,'triangle',.05);
  return 44;
 }
};
export const SOUNDTRACK_IDS=Object.keys(SOUNDTRACKS);

export function startTensionSound(kind='drumroll'){
 const context=getStageAudio();if(!context)return()=>{};context.resume();
 const play=SOUNDTRACKS[kind]||SOUNDTRACKS.drumroll;
 const master=context.createGain();master.gain.setValueAtTime(.5,context.currentTime);master.connect(context.destination);
 const bass=drone(context,master,kind==='ticks'?98:73.42,kind==='reels'?'square':'sawtooth',kind==='reels'?.01:.018);
 let step=0,stopped=false,timer;
 const tick=()=>{if(stopped)return;const wait=play(context,master,step++);timer=setTimeout(tick,wait)};
 timer=setTimeout(tick,0);
 return()=>{
  if(stopped)return;stopped=true;clearTimeout(timer);
  const now=context.currentTime;
  master.gain.cancelScheduledValues(now);master.gain.setValueAtTime(Math.max(master.gain.value,.0001),now);master.gain.exponentialRampToValueAtTime(.0001,now+.12);
  bass.stop(now+.14);setTimeout(()=>master.disconnect(),180);
 };
}

const FANFARES={
 // 기존 상승 스윕과 종소리
 chime(context,now){
  const master=context.createGain(),oscillator=context.createOscillator();
  master.gain.setValueAtTime(.0001,now);master.gain.exponentialRampToValueAtTime(.22,now+.018);master.gain.exponentialRampToValueAtTime(.0001,now+.55);
  oscillator.type='sine';oscillator.frequency.setValueAtTime(150,now);oscillator.frequency.exponentialRampToValueAtTime(760,now+.13);oscillator.frequency.exponentialRampToValueAtTime(420,now+.48);
  oscillator.connect(master).connect(context.destination);oscillator.start(now);oscillator.stop(now+.58);
  playTone(context,context.destination,1046.5,now+.1,.34,'sine',.11);playTone(context,context.destination,1568,now+.16,.3,'sine',.07);
 },
 // 짠! 하는 금관풍 팡파르
 fanfare(context,now){
  [[392,0],[523.25,.09],[659.25,.18],[783.99,.27]].forEach(([frequency,offset])=>{
   playTone(context,context.destination,frequency,now+offset,.3,'sawtooth',.06);
   playTone(context,context.destination,frequency*2,now+offset,.26,'triangle',.035);
  });
  playTone(context,context.destination,1046.5,now+.38,.7,'sine',.1);
  thump(context,context.destination,now,70,.2);
 },
 // 폭죽처럼 터지는 반짝임
 sparkle(context,now){
  playNoise(context,context.destination,now,.5,{type:'highpass',frequency:1200,sweepTo:7000,volume:.14});
  thump(context,context.destination,now,90,.22);
  [1046.5,1318.5,1567.98,2093,2637].forEach((frequency,i)=>playTone(context,context.destination,frequency,now+.05+i*.055,.42,'sine',.075));
 }
};
export const FANFARE_IDS=Object.keys(FANFARES);

export function playRevealSound(kind){
 const context=getStageAudio();if(!context)return;context.resume();
 const play=FANFARES[kind]||FANFARES[FANFARE_IDS[Math.floor(Math.random()*FANFARE_IDS.length)]];
 play(context,context.currentTime);
}

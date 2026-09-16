import React from 'react';

// 행사 화면 추첨 연출: 화면 효과와 효과음을 한 쌍으로 묶어 뽑을 때마다 무작위로 고른다.
const SLOT_SYMBOLS=['궁금','질문','토크','소통','강남','응답'];
const ROULETTE_LABELS=['질문','토크','소통','강남','응답','궁금','참여','대전환'];

export const DRAW_SCENES=[
 {id:'dice',sound:'drumroll',title:'주사위를 굴리고 있습니다',caption:'어떤 질문이 나올까요?',
  render:()=><div className="scene scene-dice"><div className="dice-shadow"/><div className="dice"><i/><i/><i/><i/><i/></div></div>},
 {id:'roulette',sound:'ticks',title:'룰렛이 돌아가고 있습니다',caption:'바늘이 멈추는 곳은 어디일까요?',
  render:()=><div className="scene scene-roulette"><div className="roulette-pin"/><div className="roulette-wheel">{ROULETTE_LABELS.map((label,i)=><span key={label} style={{'--i':i}}>{label}</span>)}</div><div className="roulette-hub"/></div>},
 {id:'slot',sound:'reels',title:'슬롯이 돌아가고 있습니다',caption:'세 칸이 맞춰지면 질문이 공개됩니다',
  render:()=><div className="scene scene-slot">{[0,1,2].map(reel=><div className="reel" key={reel} style={{'--d':reel}}><div className="reel-strip">{[...SLOT_SYMBOLS,...SLOT_SYMBOLS].map((symbol,i)=><b key={i}>{symbol}</b>)}</div></div>)}<div className="slot-line"/></div>},
 {id:'gacha',sound:'bounce',title:'뽑기 공을 고르고 있습니다',caption:'공 하나가 굴러 나오는 중이에요',
  render:()=><div className="scene scene-gacha"><div className="gacha-globe">{[0,1,2,3,4,5,6].map(i=><i key={i} style={{'--i':i}}/>)}</div><div className="gacha-chute"><span/></div></div>},
 {id:'cards',sound:'riffle',title:'질문 카드를 섞고 있습니다',caption:'한 장이 곧 뒤집힙니다',
  render:()=><div className="scene scene-cards">{[0,1,2,3,4].map(i=><div className="card" key={i} style={{'--i':i}}><span>?</span></div>)}</div>}
];

export function pickDrawScene(previousId){
 const pool=DRAW_SCENES.filter(scene=>scene.id!==previousId);
 return pool[Math.floor(Math.random()*pool.length)]||DRAW_SCENES[0];
}

export function DrawScene({scene}){
 const active=scene||DRAW_SCENES[0];
 return <div className={'draw-animation draw-'+active.id}>{active.render()}<h1>{active.title}</h1><p>{active.caption}</p></div>;
}

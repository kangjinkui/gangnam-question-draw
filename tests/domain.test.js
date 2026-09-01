import {describe,expect,it} from 'vitest';
import {drawCandidate,publicAuthor,validateQuestion} from '../src/domain.js';
describe('질문 검증',()=>{it('10~500자만 허용한다',()=>{expect(validateQuestion('짧다')).toBeTruthy();expect(validateQuestion('충분히 긴 올바른 질문입니다.')).toBe('');expect(validateQuestion('가'.repeat(501))).toBeTruthy()})});
describe('공개 범위',()=>{const q={department:'미래과',position:'주무관',name:'김강남'};it('익명은 정보를 숨긴다',()=>expect(publicAuthor({...q,disclosure:'ANONYMOUS'})).toBe('익명의 직원'));it('전체 공개는 입력 정보를 표시한다',()=>expect(publicAuthor({...q,disclosure:'FULL'})).toContain('김강남'))});
describe('추첨',()=>{it('승인된 미추첨 질문만 고른다',()=>{const qs=[{id:1,status:'HELD'},{id:2,status:'APPROVED',drawOrder:1},{id:3,status:'APPROVED',drawOrder:null}];expect(drawCandidate(qs,()=>0).id).toBe(3)});it('후보가 없으면 null',()=>expect(drawCandidate([],()=>0)).toBe(null))});

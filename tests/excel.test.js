import {describe,expect,it} from 'vitest';
import {writeFileSync} from 'node:fs';
import {approvedQuestionRows,buildXlsx} from '../src/excel.js';
const qs=[{id:'Q-000001',status:'APPROVED',text:'승인된 질문 <A&B> 입니다',displayText:'승인된 질문',department:'미래과',position:'주무관',name:'김강남',disclosure:'FULL',createdAt:'2026-09-15T00:00:00Z'},{id:'Q-000002',status:'DRAWN',text:'추첨된 질문입니다.',displayText:'추첨된 질문입니다.',disclosure:'ANONYMOUS'}];
describe('승인 질문 엑셀',()=>{
 it('승인 질문만 행으로 만든다',()=>{const rows=approvedQuestionRows(qs);expect(rows).toHaveLength(2);expect(rows[1][1]).toBe('Q-000001');expect(rows[1][9]).toContain('김강남')});
 it('xlsx ZIP 구조를 만든다',()=>{const bytes=buildXlsx(approvedQuestionRows(qs),{sheetName:'승인 질문'});expect([...bytes.slice(0,4)]).toEqual([0x50,0x4b,0x03,0x04]);const text=new TextDecoder().decode(bytes);expect(text).toContain('xl/worksheets/sheet1.xml');expect(text).toContain('&lt;A&amp;B&gt;');if(process.env.XLSX_OUT)writeFileSync(process.env.XLSX_OUT,bytes)});
});

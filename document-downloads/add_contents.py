from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from xml.etree import ElementTree as ET
import math, textwrap

ROOT=Path(__file__).resolve().parent
path=ROOT/'Happiness_Monday_SIWES_Report.docx'
W='http://schemas.openxmlformats.org/wordprocessingml/2006/main'
ET.register_namespace('w',W)
ET.register_namespace('r','http://schemas.openxmlformats.org/officeDocument/2006/relationships')
def q(n):return '{'+W+'}'+n
with ZipFile(path) as z: files={n:z.read(n) for n in z.namelist()}
root=ET.fromstring(files['word/document.xml']); body=root.find(q('body'))
paras=list(body)[:-1]; sect=list(body)[-1]
def txt(p):return ''.join(p.itertext())
def style(p):
    el=p.find('./'+q('pPr')+'/'+q('pStyle'))
    return el.get(q('val')) if el is not None else 'Normal'
def prop(p):
    el=p.find(q('pPr'))
    if el is None:el=ET.Element(q('pPr'));p.insert(0,el)
    return el
def force(p):
    pr=prop(p)
    if pr.find(q('pageBreakBefore')) is None:ET.SubElement(pr,q('pageBreakBefore'))
toc_index=next(i for i,p in enumerate(paras) if txt(p)=='TABLE OF CONTENTS')
chapter_index=next(i for i,p in enumerate(paras) if txt(p)=='CHAPTER ONE')
entries=[p for p in paras if style(p) in ('Heading1','Heading2') and txt(p)!='TABLE OF CONTENTS']
toc_pages=math.ceil(len(entries)/25)
page=1; used=0; locations={}; result=[]
for i,p in enumerate(paras):
    if toc_index<i<chapter_index:continue
    if i==toc_index:
        page+=1
        result.append(p)
        # Reserve pages occupied by the complete contents.
        page+=toc_pages-1
        used=500
        continue
    st=style(p); text=txt(p)
    if st.startswith('Cover') or st=='University':
        result.append(p);continue
    forced=p.find('./'+q('pPr')+'/'+q('pageBreakBefore')) is not None
    height=(sum(max(1,len(textwrap.wrap(line,72))) for line in text.splitlines() or [''])*18+10)
    if st=='Heading1':height=48
    elif st=='Heading2':height=50 if len(text)>72 else 34
    elif st=='ChapterTitle':height=70
    if forced or used+height>500:
        page+=1;used=0;force(p)
    if st in ('Heading1','Heading2'):
        # Keep a heading and a useful amount of its following paragraph together.
        if not forced and used+height+85>500:
            page+=1;used=0;force(p)
        locations[id(p)]=page
    result.append(p);used+=height

def run(p,text):
    r=ET.SubElement(p,q('r'));ET.SubElement(r,q('t')).text=text
contents=[]
for index,entry in enumerate(entries):
    p=ET.Element(q('p')); pr=prop(p)
    ET.SubElement(pr,q('spacing'),{q('after'):'80',q('line'):'240',q('lineRule'):'auto'})
    tabs=ET.SubElement(pr,q('tabs'));ET.SubElement(tabs,q('tab'),{q('val'):'right',q('leader'):'dot',q('pos'):'9000'})
    if index and index%25==0:force(p)
    label=txt(entry)
    if label.startswith('CHAPTER '):
        original=paras.index(entry);label+=' — '+txt(paras[original+1])
    run(p,label)
    r=ET.SubElement(p,q('r'));ET.SubElement(r,q('tab'))
    run(p,str(locations[id(entry)]))
    contents.append(p)
for child in list(body):body.remove(child)
for p in result:
    body.append(p)
    if txt(p)=='TABLE OF CONTENTS':
        begin=ET.SubElement(p,q('r'));ET.SubElement(begin,q('fldChar'),{q('fldCharType'):'begin',q('dirty'):'false'})
        inst=ET.SubElement(p,q('r'));ET.SubElement(inst,q('instrText')).text=' TOC \\o "1-2" \\h \\z \\u '
        sep=ET.SubElement(p,q('r'));ET.SubElement(sep,q('fldChar'),{q('fldCharType'):'separate'})
        for item in contents:body.append(item)
        end=ET.SubElement(contents[-1],q('r'));ET.SubElement(end,q('fldChar'),{q('fldCharType'):'end'})
body.append(sect)
files['word/document.xml']=ET.tostring(root,encoding='utf-8',xml_declaration=True)
settings=ET.fromstring(files['word/settings.xml'])
settings.find(q('updateFields')).set(q('val'),'false')
files['word/settings.xml']=ET.tostring(settings,encoding='utf-8',xml_declaration=True)
temp=path.with_suffix('.tmp')
with ZipFile(temp,'w',ZIP_DEFLATED) as z:
    for n,data in files.items():z.writestr(n,data)
temp.replace(path)
with ZipFile(path) as z:
    for n in z.namelist():ET.fromstring(z.read(n))
print(f'Updated {path.name}: {len(entries)} contents entries over {toc_pages} contents pages; {page} document pages with explicit pagination. XML validated.')

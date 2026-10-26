from pathlib import Path
from xml.sax.saxutils import escape
from zipfile import ZipFile, ZIP_DEFLATED
import re, html

OUT = Path(__file__).resolve().parent
SOURCE = Path(r'C:\Users\USER\.codex\attachments\a28149df-f9a0-4c6c-a8b3-c734e864aebe\Pasted text.txt')
lines = [s.strip() for s in SOURCE.read_text(encoding='utf-8-sig').splitlines() if s.strip()]
parts=[]; web=[]
def p(text='', style='Normal', page=False):
    props=f'<w:pStyle w:val="{style}"/>' + ('<w:pageBreakBefore/>' if page else '')
    parts.append(f'<w:p><w:pPr>{props}</w:pPr><w:r><w:t xml:space="preserve">{escape(text)}</w:t></w:r></w:p>')
    tag='h1' if style=='Heading1' else 'h2' if style=='Heading2' else 'p'
    web.append(f'<{tag} class="{style}{" newpage" if page else ""}">{html.escape(text)}</{tag}>')

cover=[('EKITI STATE UNIVERSITY, ADO-EKITI','University'),('DEPARTMENT OF MASS COMMUNICATION','CoverSmall'),('STUDENTS’ INDUSTRIAL WORK EXPERIENCE SCHEME','CoverTitle'),('(SIWES) REPORT','CoverTitle'),('UNDERTAKEN AT','CoverSmall'),('THE CHARTERED INSTITUTE OF BANKERS OF NIGERIA (CIBN)','CoverHeading'),('Corporate Communications and Brand Management Department','CoverSmall'),('[INSERT CIBN OFFICE LOCATION]','CoverSmall'),('BY','CoverSmall'),('UDO-AKA HAPPINESS MONDAY','CoverHeading'),('Matriculation number: [INSERT MATRICULATION NUMBER]','CoverSmall'),('SUBMITTED TO','CoverSmall'),('The Department of Mass Communication','CoverSmall'),('Faculty of Multidisciplinary Studies','CoverSmall'),('Ekiti State University, Ado-Ekiti, Nigeria','CoverSmall'),('In partial fulfilment of the requirements for the award of the Bachelor of Science (B.Sc.) degree in Mass Communication','CoverSmall'),('TRAINING PERIOD: MAY – SEPTEMBER 2026','CoverHeading')]
web.append('<section class="cover">')
for t,s in cover:p(t,s)
web.append('</section>')
start=lines.index('CERTIFICATION'); i=start
major={'CERTIFICATION','DEDICATION','ACKNOWLEDGEMENT','ABSTRACT','TABLE OF CONTENTS','REFERENCES','APPENDICES'}
while i<len(lines):
    s=lines[i]
    if s.startswith('________________') or s.startswith('Industrial Training Supervisor') or s.startswith('Date:'):
        i+=1;continue
    if s.startswith('Note: In Microsoft Word'):
        i+=1;continue
    if s in major or s.startswith('CHAPTER '):
        p(s,'Heading1',True)
        if s=='TABLE OF CONTENTS':
            parts.append('<w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> TOC \\o "1-2" \\h \\z \\u </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>Right-click here in Microsoft Word and choose Update Field to generate the contents and page numbers.</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>')
            for j,line in enumerate(lines):
                if line.startswith('CHAPTER '):
                    web.append('<p class="contents">'+html.escape(line+' — '+lines[j+1])+'</p>')
            web.append('<p class="contents">References</p><p class="contents">Appendices</p>')
        if s.startswith('CHAPTER '):
            i+=1;p(lines[i],'ChapterTitle')
    elif re.match(r'^\d+\.\d+',s) or s.startswith('Appendix '):p(s,'Heading2')
    elif s.startswith('•'):p(s,'ListParagraph')
    else:
        s=s.replace('with matriculation number,','with matriculation number [INSERT MATRICULATION NUMBER],')
        p(s)
        if s=='The report is submitted in partial fulfilment of the requirements for the award of the Bachelor of Science (B.Sc.) degree in Mass Communication.':
            for title in ['Industrial Training Supervisor','Departmental SIWES Coordinator / Head of Department']:
                p('','Signature');p('Signature: __________________________________','Signature');p(title,'Signature');p('Name: _____________________________________','Signature');p('Date: ______________________________________','Signature')
    i+=1

styles=['<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:pPr><w:spacing w:after="160" w:line="360" w:lineRule="auto"/><w:jc w:val="both"/></w:pPr><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="24"/></w:rPr></w:style>']
for name,size,bold,center in [('Heading1',30,True,True),('Heading2',26,True,False),('ChapterTitle',28,True,True),('University',32,True,True),('CoverTitle',32,True,True),('CoverHeading',25,True,True),('CoverSmall',23,False,True),('ListParagraph',24,False,False),('Signature',24,False,False)]:
    outline='<w:outlineLvl w:val="'+('0' if name=='Heading1' else '1')+'"/>' if name.startswith('Heading') else ''
    styles.append(f'<w:style w:type="paragraph" w:styleId="{name}"><w:name w:val="{name}"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="120" w:after="160" w:line="280"/>'+('<w:keepNext/>' if name in ['Heading1','Heading2','ChapterTitle'] else '')+f'<w:jc w:val="{"center" if center else "left"}"/>{outline}</w:pPr><w:rPr><w:sz w:val="{size}"/>'+('<w:b/>' if bold else '')+'</w:rPr></w:style>')
ns='http://schemas.openxmlformats.org/wordprocessingml/2006/main'
doc=f'<w:document xmlns:w="{ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>'+''.join(parts)+'<w:sectPr><w:footerReference w:type="default" r:id="rId3"/><w:titlePg/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1440" w:footer="560"/></w:sectPr></w:body></w:document>'
with ZipFile(OUT/'Happiness_Monday_SIWES_Report.docx','w',ZIP_DEFLATED) as z:
    z.writestr('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'+''.join(f'<Override PartName="/word/{n}.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.{t}+xml"/>' for n,t in [('document','document.main'),('styles','styles'),('settings','settings'),('footer1','footer')])+'</Types>')
    z.writestr('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
    z.writestr('word/document.xml',doc)
    z.writestr('word/styles.xml',f'<w:styles xmlns:w="{ns}">'+''.join(styles)+'</w:styles>')
    z.writestr('word/settings.xml',f'<w:settings xmlns:w="{ns}"><w:updateFields w:val="true"/></w:settings>')
    z.writestr('word/footer1.xml',f'<w:ftr xmlns:w="{ns}"><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>')
    z.writestr('word/_rels/document.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+''.join(f'<Relationship Id="rId{i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/{t}" Target="{n}.xml"/>' for i,t,n in [(1,'styles','styles'),(2,'settings','settings'),(3,'footer','footer1')])+'</Relationships>')
css='''@page{size:A4;margin:25mm 23mm 25mm 30mm}body{font:12pt/1.5 "Times New Roman",serif;color:#17202a}p{text-align:justify;margin:0 0 9pt;orphans:3;widows:3}h1,h2{break-after:avoid}h1{text-align:center;font-size:16pt;margin:0 0 20pt}h2{font-size:13pt;margin:18pt 0 9pt}.newpage{break-before:page}.cover{text-align:center;min-height:235mm}.cover p{text-align:center;line-height:1.35;margin-bottom:14pt}.University{font-size:17pt;font-weight:bold;color:#233b50}.CoverTitle{font-size:18pt;font-weight:bold}.CoverHeading{font-size:13pt;font-weight:bold}.CoverSmall{font-size:11pt}.ChapterTitle{text-align:center;font-size:15pt;font-weight:bold;margin-bottom:24pt}.Signature{margin-top:12pt;text-align:left}.contents{text-align:left;margin:16pt 0}.ListParagraph{padding-left:12pt}'''
(OUT/'Happiness_Monday_SIWES_Report.html').write_text('<!doctype html><html><head><meta charset="utf-8"><title>SIWES Report — Udo-Aka Happiness Monday</title><style>'+css+'</style></head><body>'+''.join(web)+'</body></html>',encoding='utf-8')
(OUT/'READ_ME.txt').write_text('Open Happiness_Monday_SIWES_Report.docx in Microsoft Word to edit. Update the table of contents: right-click it, choose Update Field, then Update entire table. Fill all bracketed placeholders, verify the provisional references and draft notes, and obtain the required signatures before submission. The HTML file is a browser-readable backup. All report files are isolated in this folder; application source files were not changed.',encoding='utf-8')
print('Created editable DOCX and print-ready HTML in',OUT)

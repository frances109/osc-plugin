/**
 * scorecard.js — Outsourcing Readiness Scorecard
 *
 * Plain IIFE. Dependencies resolved by build.mjs:
 *   - jsPDF UMD prepended as banner  → window.jspdf available
 *   - jQuery, Bootstrap, intl-tel-input loaded by PHP template from dist/vendor/
 *
 * window.MagellanConfig injected by templates/page-scorecard.php:
 *   restUrl, nonce, recaptchaSiteKey, readinessPdfUrl, distBase, assetsBase
 */
(function ($) {
    'use strict';

    var MG = window.MagellanConfig || {};

    /* ================================================================
       DATA
       ================================================================ */
    var CONFIG = {
        clusters: [
            { title: 'Company Profile', questions: [
                { id:'q1', type:'select', required:true, label:'1. What best describes your role?', error:'Please select your role.', options:[{value:'founder',label:'Founder / Owner'},{value:'coo',label:'COO / Ops Manager'},{value:'manager',label:'Manager'},{value:'other',label:'Other'}] },
                { id:'q2', type:'select', required:true, label:'2. Company size?', error:'Please select company size.', options:[{value:'1-5',label:'1\u20135'},{value:'6-10',label:'6\u201310'},{value:'11-50',label:'11\u201350'},{value:'51-200',label:'51\u2013200'},{value:'200+',label:'200+'}] },
                { id:'q3', type:'select', required:true, label:'3. Primary industry?', error:'Please select your industry.', options:[{value:'ecommerce',label:'E-commerce'},{value:'agency',label:'Agency / Services'},{value:'saas',label:'SaaS / Tech'},{value:'professional',label:'Professional Services'},{value:'other',label:'Other'}] }
            ]},
            { title: 'Operational Challenges', questions: [
                { id:'q4', type:'checkbox', required:true, label:'4. Which areas take up most of your time?', error:'Please select at least one option.', options:[{value:'admin',label:'Admin / Back office'},{value:'support',label:'Customer support'},{value:'sales',label:'Sales support'},{value:'finance',label:'Finance / Bookkeeping'},{value:'ops',label:'Operations / QA'}] },
                { id:'q5', type:'select', required:true, label:'5. What is your biggest operational frustration right now?', error:'Please select an option.', options:[{value:'hiring',label:'Hiring takes too long'},{value:'costs',label:'Costs are too high'},{value:'quality',label:'Quality inconsistency'},{value:'process',label:'Lack of process'},{value:'timezone',label:'Time zone challenges'}] },
                { id:'q6', type:'select', required:true, label:'6. How severe are these challenges?', error:'Please select severity.', options:[{value:'minimal',label:'Minimal'},{value:'moderate',label:'Moderate'},{value:'severe',label:'Severe'}] }
            ]},
            { title: 'Process & Systems', questions: [
                { id:'q7', type:'select', required:true, label:'7. Do you currently have documented processes?', error:'Please select an option.', options:[{value:'yes',label:'Yes, for most tasks'},{value:'some',label:'Some, but incomplete'},{value:'no',label:'No formal documentation'}] },
                { id:'q8', type:'select', required:true, label:'8. Do you use collaboration tools for remote work?', error:'Please select an option.', options:[{value:'full',label:'Yes, fully adopted'},{value:'partial',label:'Partially'},{value:'no',label:'No'}] }
            ]},
            { title: 'Outsourcing Experience & Concerns', questions: [
                { id:'q9', type:'select', required:true, label:'9. Have you outsourced before?', error:'Please select an option.', options:[{value:'success',label:'Yes, successfully'},{value:'fail',label:'Yes, unsuccessfully'},{value:'no',label:'No'}] },
                { id:'q10', type:'select', required:true, label:'10. What is your main concern about outsourcing?', error:'Please select an option.', options:[{value:'control',label:'Loss of control'},{value:'quality',label:'Quality issues'},{value:'comm',label:'Communication'},{value:'security',label:'Security'},{value:'culture',label:'Cultural fit'}] }
            ]},
            { title: 'Decision Readiness', questions: [
                { id:'q11', type:'select', required:true, label:'11. How comfortable are you with change and risk in operations?', error:'Please select an option.', options:[{value:'high',label:'Very comfortable'},{value:'medium',label:'Somewhat comfortable'},{value:'low',label:'Not comfortable'}] },
                { id:'q12', type:'select', required:true, label:'12. Do you have budget allocated for outsourcing?', error:'Please select an option.', options:[{value:'yes',label:'Yes'},{value:'planning',label:'Planning stage'},{value:'no',label:'No'}] },
                { id:'q13', type:'select', required:true, label:'13. Timeline for outsourcing?', error:'Please select an option.', options:[{value:'now',label:'Now'},{value:'soon',label:'1\u20133 months'},{value:'exploring',label:'Exploring'},{value:'none',label:'No timeline yet'}] },
                { id:'q14', type:'select', required:true, label:'14. What is your primary goal for outsourcing?', error:'Please select an option.', options:[{value:'cost',label:'Cost reduction'},{value:'scale',label:'Scalability'},{value:'focus',label:'Focus on core business'},{value:'expertise',label:'Access to expertise'}] },
                { id:'q15', type:'select', required:true, label:'15. Are you the final decision-maker for outsourcing?', error:'Please select an option.', options:[{value:'yes',label:'Yes'},{value:'shared',label:'Shared with others'},{value:'no',label:'No'}] }
            ]},
            { title: 'Contact Details', questions: [
                { id:'q16group', type:'contact', label:'16. Where should we send your results?', fields:[
                    {id:'fullname',type:'text', name:'fullname',placeholder:'Full Name',   required:true,error:'Please enter your name.'},
                    {id:'email',   type:'email',name:'email',   placeholder:'Email',       required:true,error:'Please enter a valid business email.'},
                    {id:'phone',   type:'tel',  name:'phone',   placeholder:'Phone Number',required:true,error:'Please enter a valid phone number.'},
                    {id:'company', type:'text', name:'company', placeholder:'Company Name',required:true,error:'Please enter your company name.'}
                ]}
            ]}
        ]
    };

    var SCORING_RULES = [
        {field:'q7', cases:{yes:{pts:3,msg:'You have documented processes, a strong foundation.'},some:{pts:2,msg:'You have partial documentation, but it is incomplete.'},_:{pts:0,msg:'You lack formal documentation, which reduces readiness.'}}},
        {field:'q8', cases:{full:{pts:3,msg:'You have fully adopted collaboration tools, supporting outsourcing.'},partial:{pts:2,msg:'You use collaboration tools partially, which may limit efficiency.'},_:{pts:0,msg:'You do not use collaboration tools, which could hinder outsourcing success.'}}},
        {field:'q9', cases:{success:{pts:2,msg:'You have successfully outsourced before, showing proven capability.'},fail:{pts:1,msg:'You have tried outsourcing but faced challenges.'},_:{pts:0,msg:'You have no prior outsourcing experience, which means a learning curve ahead.'}}},
        {field:'q12',cases:{yes:{pts:3,msg:'You already have a budget allocated for outsourcing.'},planning:{pts:2,msg:'You are in the planning stage for budgeting.'},_:{pts:0,msg:'You have not yet allocated a budget for outsourcing.'}}},
        {field:'q13',cases:{now:{pts:3,msg:'Your timeline indicates readiness to start immediately.'},soon:{pts:2,msg:'You are considering outsourcing within the next 1\u20133 months.'},_:{pts:0,msg:'You are still exploring and have no fixed timeline.'}}},
        {field:'q11',cases:{high:{pts:2,msg:'You are very comfortable with change and risk.'},medium:{pts:1,msg:'You are somewhat comfortable with change and risk.'},_:{pts:0,msg:'You are not comfortable with change and risk, which may slow adoption.'}}},
        {field:'q6', cases:{severe:{pts:2,msg:'Your operational challenges are severe, increasing urgency.'},moderate:{pts:1,msg:'Your operational challenges are moderate.'},_:{pts:0,msg:'Your operational challenges are minimal.'}}}
    ];

    var TIERS = [
        {min:14,title:'You are Outsourcing Ready!',body:'Your organization already has the operational maturity needed to outsource successfully. Documented processes, collaboration tools, and leadership readiness indicate that external teams can integrate smoothly into your workflow. The next step is identifying the right functions to outsource and building a structured onboarding plan.',goalLine:'outsourcing can help accelerate this by reallocating internal resources to higher-value strategic work.',ctas:[{label:'Request your Strategy Call',action:'schedule'}]},
        {min:9, title:'You are Partially Ready.',body:'Your company has the foundations for outsourcing, but a few operational gaps could slow down success. Strengthening documentation, improving communication workflows, and clarifying responsibilities will make outsourcing significantly more effective.',goalLine:"preparing these systems will ensure outsourcing delivers the results you're aiming for.",ctas:[{label:'Book a Consultation',action:'consult'},{label:'Download Our Readiness Guide',action:'download'}]},
        {min:0, title:'You are Not Ready Yet.',body:'Before outsourcing, it would be beneficial to strengthen your internal operational structure. Clear processes, defined roles, and consistent workflows create the foundation external teams rely on. Building these systems first will significantly increase outsourcing success.',goalLine:'outsourcing can help you achieve your goal more effectively once your internal operations are stronger.',ctas:[{label:'Book a Consultation',action:'consult'},{label:'Download Our Readiness Guide',action:'download'}]}
    ];

    /* ================================================================
       EMAIL VALIDATION
       ================================================================ */
    var BLOCKED_DOMAINS=['example.com','test.com','mailinator.com','guerrillamail.com','tempmail.com','throwaway.email','yopmail.com','sharklasers.com','guerrillamailblock.com','grr.la','guerrillamail.info','spam4.me','trashmail.com','dispostable.com','fakeinbox.com','maildrop.cc','discard.email','spamgourmet.com','mailnull.com','spamcorpse.com','example.org','example.net','invalid.com'];

    function isTestEmail(e){var l=(e||'').toLowerCase().trim(),i=l.indexOf('@');if(i<0)return true;var p=l.slice(0,i),d=l.slice(i+1);if(BLOCKED_DOMAINS.indexOf(d)>-1)return true;if(/^tests?(?:\d+)?$/.test(p))return true;if(/^(dummy|fake|sample|noreply|no-reply|admin)$/.test(p))return true;return false;}
    function isValidEmailFormat(e){return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((e||'').trim());}

    /* ================================================================
       PDF BUILDER  (jsPDF prepended by build.mjs → window.jspdf)
       ================================================================ */
    var C={navy:[15,31,61],navyMid:[26,50,96],accent:[84,200,239],white:[255,255,255],offWhite:[244,246,251],muted:[107,122,153],text:[30,40,60]};
    var PW=210,PH=297,ML=18,MR=18,CW=PW-ML-MR;
    function pF(d,c){d.setFillColor(c[0],c[1],c[2]);}
    function pD(d,c){d.setDrawColor(c[0],c[1],c[2]);}
    function pT(d,c){d.setTextColor(c[0],c[1],c[2]);}

    function pdfCover(doc){pF(doc,C.navy);doc.rect(0,0,PW,PH,'F');pF(doc,C.accent);doc.rect(0,0,PW,4,'F');doc.rect(0,PH-4,PW,4,'F');pF(doc,C.navyMid);doc.triangle(PW-80,0,PW,0,PW,90,'F');pT(doc,C.accent);doc.setFont('helvetica','bold');doc.setFontSize(11);doc.text('MAGELLAN SOLUTIONS',ML,30);pT(doc,C.white);doc.setFontSize(32);doc.text('Outsourcing',ML,110);doc.text('Readiness',ML,125);pT(doc,C.accent);doc.text('Results',ML,140);pT(doc,[180,195,220]);doc.setFont('helvetica','normal');doc.setFontSize(12);doc.text('Your personalised outsourcing readiness report.',ML,158);}
    function pdfPageHeader(doc,label){pF(doc,C.navy);doc.rect(0,0,PW,18,'F');pT(doc,C.accent);doc.setFont('helvetica','bold');doc.setFontSize(8);doc.text('MAGELLAN SOLUTIONS  \u00B7  OUTSOURCING READINESS RESULTS',ML,11);pT(doc,[180,195,220]);doc.setFont('helvetica','normal');doc.text(label,PW-MR,11,{align:'right'});}
    function pdfPageFooter(doc,n){pF(doc,C.offWhite);doc.rect(0,PH-12,PW,12,'F');pT(doc,C.muted);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.text('\u00A9 '+new Date().getFullYear()+' Magellan Solutions. All rights reserved.',ML,PH-4.5);doc.text('Page '+n,PW-MR,PH-4.5,{align:'right'});}
    function pdfH(doc,y,t){pF(doc,C.accent);doc.rect(ML,y-1,4,8,'F');pT(doc,C.navy);doc.setFont('helvetica','bold');doc.setFontSize(14);doc.text(t,ML+8,y+5);return y+18;}
    function pdfP(doc,y,t,o){var op=o||{};pT(doc,op.color||C.text);doc.setFont('helvetica',op.bold?'bold':'normal');doc.setFontSize(op.fontSize||10);var l=doc.splitTextToSize(t,op.maxWidth||CW);doc.text(l,ML,y);return y+l.length*((op.fontSize||10)*0.45)+4;}
    function pdfCallout(doc,y,t,h){var bh=h||20;pF(doc,C.offWhite);pD(doc,C.accent);doc.setLineWidth(0.5);doc.roundedRect(ML,y,CW,bh,3,3,'FD');pT(doc,C.navy);doc.setFont('helvetica','normal');doc.setFontSize(9.5);var l=doc.splitTextToSize(t,CW-10);doc.text(l,ML+5,y+7);return y+bh+6;}
    function pdfBullets(doc,y,items){pT(doc,C.text);doc.setFont('helvetica','normal');doc.setFontSize(10);items.forEach(function(item){pF(doc,C.accent);doc.circle(ML+2,y-1.5,1.2,'F');pT(doc,C.text);var l=doc.splitTextToSize(item,CW-10);doc.text(l,ML+8,y);y+=l.length*5.5+2;});return y+2;}
    function pdfRule(doc,y){pD(doc,[220,225,235]);doc.setLineWidth(0.3);doc.line(ML,y,ML+CW,y);return y+8;}
    function pdfStep(doc,y,n,title,body){var bh=28;pF(doc,C.offWhite);doc.roundedRect(ML,y,CW,bh,3,3,'F');pF(doc,C.navy);doc.circle(ML+10,y+14,7,'F');pT(doc,C.white);doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text(String(n),ML+10,y+17.5,{align:'center'});pT(doc,C.navy);doc.setFont('helvetica','bold');doc.setFontSize(11);doc.text(title,ML+22,y+12);pT(doc,C.muted);doc.setFont('helvetica','normal');doc.setFontSize(9);var l=doc.splitTextToSize(body,CW-28);doc.text(l,ML+22,y+20);return y+bh+5;}
    function pdfTierCard(doc,y,tt,tb,gl,ga,ins){pF(doc,C.navy);doc.roundedRect(ML,y,CW,14,3,3,'F');pT(doc,C.accent);doc.setFont('helvetica','bold');doc.setFontSize(13);doc.text(tt,ML+6,y+9.5);y+=20;y=pdfP(doc,y,tb,{color:C.text});y+=4;y=pdfCallout(doc,y,'Since your primary goal is '+ga+', '+gl,18);y=pdfP(doc,y,'Key Insights:',{bold:true,color:C.navyMid});y=pdfBullets(doc,y+2,ins);return y;}

    function generateResultsPDFBase64(formData,tierTitle,tierBody,goalLine,insights){
        var jsPDFCtor=window.jspdf&&window.jspdf.jsPDF;
        if(!jsPDFCtor){console.warn('[scorecard] jsPDF not available');return '';}
        var doc=new jsPDFCtor({unit:'mm',format:'a4'}),y;

        pdfCover(doc);pdfPageFooter(doc,1);

        doc.addPage();pdfPageHeader(doc,'INTRODUCTION');pdfPageFooter(doc,2);y=30;
        y=pdfH(doc,y,'What is Outsourcing Readiness?');
        y=pdfP(doc,y,'Outsourcing readiness refers to the degree to which your organisation has the operational, financial, and cultural foundations required to successfully delegate functions to an external team. It is not simply a question of whether you want to outsource \u2014 it is about whether your organisation is structurally prepared to make outsourcing work.',{color:C.text});y+=4;
        y=pdfCallout(doc,y,'Companies that outsource without readiness often face quality issues, communication breakdowns, and wasted investment. This guide helps you avoid those pitfalls.',22);
        y=pdfP(doc,y,'The Magellan Solutions Readiness Assessment evaluates five dimensions:',{bold:true,color:C.navy});
        y=pdfBullets(doc,y+2,['Company Profile \u2014 who you are and your industry context','Operational Challenges \u2014 the pain points driving your outsourcing interest','Process & Systems \u2014 your documentation and tooling maturity','Outsourcing Experience & Concerns \u2014 what you know and what worries you','Decision Readiness \u2014 your budget, timeline, and authority to act']);

        doc.addPage();pdfPageHeader(doc,'READINESS TIERS');pdfPageFooter(doc,3);y=30;
        y=pdfH(doc,y,'The Three Readiness Tiers');
        y=pdfP(doc,y,'Your assessment score places you in one of three tiers. Understanding your tier is the starting point for knowing what to do next.',{color:C.text});y+=6;
        y=pdfStep(doc,y,1,'Outsourcing Ready  (Score 14\u201316)','Strong processes, tools, and decision authority are in place. You can begin outsourcing now with high confidence of success.');
        y=pdfStep(doc,y,2,'Partially Ready  (Score 9\u201313)','Good foundations exist but gaps in documentation, tools, or buy-in may limit early results. Targeted preparation will significantly improve outcomes.');
        y=pdfStep(doc,y,3,'Not Ready Yet  (Score 0\u20138)','Outsourcing before addressing key structural gaps often leads to failure. A focused readiness roadmap should come first.');
        y+=4;y=pdfRule(doc,y);
        y=pdfP(doc,y,'Regardless of your tier, outsourcing is achievable. The tiers help you time your decision and set realistic expectations \u2014 not to discourage action, but to make your action count.',{color:C.muted});

        doc.addPage();pdfPageHeader(doc,'NEXT STEPS');pdfPageFooter(doc,4);y=30;
        y=pdfH(doc,y,'What to Do Next');
        [{n:1,t:'Review your score and tier',b:'Understand the specific factors that influenced your result. Each insight in your results indicates an area of strength or a gap to address.'},
         {n:2,t:'Address your critical gaps first',b:'If you scored Partially Ready or Not Ready, prioritise closing the gaps with the highest impact: documentation, tooling, and stakeholder alignment.'},
         {n:3,t:'Define the scope of outsourcing',b:'Identify 1\u20133 specific functions to outsource initially. Start narrow, prove the model, then expand. Avoid trying to outsource everything at once.'},
         {n:4,t:'Build your selection criteria',b:'Determine what you need in an outsourcing partner: industry experience, communication standards, team size, pricing model, and cultural alignment.'},
         {n:5,t:'Engage with a trusted provider',b:'Magellan Solutions specialises in helping SMEs and growing companies outsource the right way. Schedule a strategy call to discuss your specific situation.'}
        ].forEach(function(item){y=pdfStep(doc,y,item.n,item.t,item.b);});

        if(formData&&tierTitle){
            doc.addPage();pdfPageHeader(doc,'YOUR RESULTS');pdfPageFooter(doc,5);y=30;
            y=pdfH(doc,y,'Your Personalised Assessment Results');
            var fullname=formData.get('fullname')||'',company=formData.get('company')||'',goalAnswer='';
            CONFIG.clusters.forEach(function(cl){cl.questions.forEach(function(q){if(q.id==='q14'&&q.options){var opt=q.options.find(function(o){return o.value===formData.get('q14');});if(opt)goalAnswer=opt.label;}});});
            if(fullname){y=pdfP(doc,y,'Prepared for: '+fullname+(company?'  \u00B7  '+company:''),{bold:true,color:C.navyMid,fontSize:10});y+=4;}
            y=pdfTierCard(doc,y,tierTitle,tierBody,goalLine,goalAnswer,insights||[]);
        }

        doc.addPage();var lp=doc.internal.getNumberOfPages();
        pdfPageHeader(doc,'ABOUT MAGELLAN');pdfPageFooter(doc,lp);y=30;
        y=pdfH(doc,y,'About Magellan Solutions');
        y=pdfP(doc,y,'Magellan Solutions is a Philippines-based business process outsourcing (BPO) company founded in 2005, specialising in delivering scalable outsourcing solutions to small and medium-sized businesses worldwide. With 500+ dedicated staff and nearly two decades of industry experience, Magellan Solutions partners with clients across the US, Australia, UK, and beyond to help them reduce operational costs and focus on growth.',{color:C.text});y+=6;
        y=pdfP(doc,y,'We are ISO-certified and HIPAA-compliant, with a track record of delivering measurable results for clients in healthcare, e-commerce, professional services, SaaS, and more.',{color:C.text});y+=6;
        y=pdfP(doc,y,'Our Core Services:',{bold:true,color:C.navy});
        y=pdfBullets(doc,y+2,['Customer Support & Technical Help Desk','Finance & Accounting (Bookkeeping, AP/AR, Payroll)','Sales Support & Lead Generation / Appointment Setting','Back Office & Data Management','Healthcare Support (Medical Billing, Transcription)','Digital Marketing & Content Operations','IT & Software Support']);y+=4;
        var ct=tierTitle&&tierTitle.toLowerCase().indexOf('ready!')>-1?'Your business is ready to outsource. Visit magellan-solutions.com or request a strategy call to start building your custom outsourcing solution.':tierTitle&&tierTitle.toLowerCase().indexOf('partially')>-1?"You're almost there. Book a consultation at magellan-solutions.com and we'll help you close the gaps before you outsource.":'Building the right foundations makes all the difference. Book a consultation at magellan-solutions.com and we\'ll create a readiness roadmap for your business.';
        pdfCallout(doc,y,ct,20);

        return doc.output('datauristring').split(',')[1];
    }

    /* ================================================================
       READINESS GUIDE DOWNLOAD
       ================================================================ */
    function downloadReadinessGuide(){
        var url=MG.readinessPdfUrl||'',orig,btn=$('[data-action="download"]');
        orig=btn.text();
        if(!url){alert('PDF not available.');return;}
        btn.prop('disabled',true).text('Downloading\u2026');
        fetch(url).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.blob();})
            .then(function(blob){var u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='Outsourcing-Readiness-Checklist.pdf';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(u);btn.prop('disabled',false).text(orig);})
            .catch(function(){btn.prop('disabled',false).text(orig);alert('Could not download. Please try again.');});
    }

    /* ================================================================
       FORM BUILDER
       ================================================================ */
    function buildSelect(q){var $s=$('<select>').attr({name:q.id,id:q.id}).addClass('form-select');if(q.required)$s.attr('required',true);$s.append($('<option>').val('').attr({disabled:true,selected:true,hidden:true}).text('-- Please choose an option --'));q.options.forEach(function(o){$s.append($('<option>').val(o.value).text(o.label));});return $s;}
    function buildCheckboxGroup(q){var $w=$('<div>').addClass('checkbox-card-grid');q.options.forEach(function(o){var uid=q.id+'-'+o.value;$w.append($('<div>').addClass('checkbox-card-item').append($('<input>').attr({type:'checkbox',id:uid,name:q.id+'[]',value:o.value}).addClass('checkbox-card-input q4check'),$('<label>').attr('for',uid).addClass('checkbox-card-label').append($('<span>').addClass('checkbox-card-tick'),$('<span>').addClass('checkbox-card-text').text(o.label))));});$w.append($('<div>').attr('id','q4error').addClass('invalid-feedback d-none').text(q.error));return $w;}
    function buildContactGroup(q){var $w=$('<div>').addClass('row g-2');q.fields.forEach(function(f){var $c=$('<div>').addClass('col-12 col-sm-6'),i=$('<input>').attr({type:f.type,id:f.id,name:f.name,placeholder:f.placeholder}).addClass('form-control');if(f.required)i.attr('required',true);$c.append(i);if(f.error)$c.append($('<div>').addClass('invalid-feedback').text(f.error));$w.append($c);});return $w;}
    function buildQuestion(q){var $d=$('<div>').addClass('question mb-3');$d.append($('<label>').attr('for',q.id).addClass('form-label').text(q.label));if(q.type==='select'){$d.append(buildSelect(q));$d.append($('<div>').addClass('invalid-feedback').text(q.error));}else if(q.type==='checkbox'){$d.append(buildCheckboxGroup(q));}else if(q.type==='contact'){$d.append(buildContactGroup(q));}return $d;}

    function buildForm(){
        var $c=$('#clusterContainer'),total=CONFIG.clusters.length;
        CONFIG.clusters.forEach(function(cluster,idx){
            var $cl=$('<div>').addClass('cluster'),n=idx+1;
            var $pw=$('<div>').addClass('step-progress-wrap');
            $pw.append($('<div>').addClass('step-progress-info').append($('<span>').addClass('step-progress-label').text('STEP '+n+' OF '+total),$('<span>').addClass('step-progress-title').text(cluster.title.toUpperCase())),$('<div>').addClass('step-progress-bar').append($('<div>').addClass('step-progress-fill').css('width',((n/total)*100)+'%')));
            $cl.append($pw);$cl.append($('<div>').addClass('cluster-step-label').text('STEP '+n));$cl.append($('<h3>').addClass('cluster-title').text(cluster.title));
            var hasMany=cluster.questions.length>=3,hasCb=cluster.questions.some(function(q){return q.type==='checkbox';});
            var $qw=(hasMany||hasCb)?$('<div>').addClass('question-grid'):$('<div>');
            cluster.questions.forEach(function(q){var $q=buildQuestion(q);if((hasMany||hasCb)&&(q.type==='contact'||q.type==='checkbox'))$q.addClass('question-full');$qw.append($q);});
            $cl.append($qw);$c.append($cl);
        });
    }

    /* ================================================================
       NAVIGATION
       ================================================================ */
    function updateNav(step,$cl){var f=step===0,l=step===$cl.length-1;$('#prevBtn').toggleClass('d-none',f);$('#nextBtn').toggleClass('d-none',l);$('#prevBtnMobile').css('visibility',f?'hidden':'visible');$('#nextBtnMobile').css('visibility',l?'hidden':'visible');$('#submitBtn').toggleClass('d-none',!l);}
    function goNext(s){if(!validateCluster(s.$clusters.eq(s.step)))return;s.$clusters.eq(s.step).hide();s.step++;s.$clusters.eq(s.step).show();updateNav(s.step,s.$clusters);}
    function goPrev(s){s.$clusters.eq(s.step).hide();s.step--;s.$clusters.eq(s.step).show();updateNav(s.step,s.$clusters);}

    /* ================================================================
       VALIDATION
       ================================================================ */
    var itiInstance=null;

    function validateCluster($cluster){
        var valid=true;
        $cluster.find('[required]').each(function(){var ok=!!$(this).val();$(this).toggleClass('is-invalid',!ok);if(!ok)valid=false;});
        var $e=$cluster.find('#email');
        if($e.length&&$e.val()){var v=$e.val().trim(),$fb=$e.next('.invalid-feedback');if(!isValidEmailFormat(v)){$e.addClass('is-invalid');$fb.text('Please enter a valid email address.');valid=false;}else if(isTestEmail(v)){$e.addClass('is-invalid');$fb.text('Please use a real business email address.');valid=false;}else{$e.removeClass('is-invalid');}}
        var $p=$cluster.find('#phone');
        if($p.length&&itiInstance&&$p.val().trim()){if(!itiInstance.isValidNumber()){$p.addClass('is-invalid');$p.closest('.col-12').find('.invalid-feedback').text('Please enter a valid phone number for the selected country.');valid=false;}else{$p.removeClass('is-invalid');}}
        var $ch=$cluster.find('.q4check');
        if($ch.length){var checked=$ch.is(':checked');$('#q4error').toggleClass('d-none',checked);$ch.each(function(){$(this).toggleClass('is-invalid',!checked);});if(!checked)valid=false;}
        return valid;
    }

    /* ================================================================
       SCORING
       ================================================================ */
    function calcScore(fd){var s=0;SCORING_RULES.forEach(function(r){var x=r.cases[fd.get(r.field)]||r.cases['_'];if(x)s+=x.pts;});return s;}
    function extractAnswers(fd){var a={};for(var p of fd.entries()){if(['fullname','email','phone','company'].indexOf(p[0])>-1)continue;var k=p[0].replace(/\[\]$/,'');a[k]=a[k]?a[k]+', '+p[1]:p[1];}return a;}

    /* ================================================================
       RECAPTCHA
       ================================================================ */
    function getRecaptchaToken(){return new Promise(function(resolve){if(!MG.recaptchaSiteKey){resolve('dev-bypass');return;}if(typeof grecaptcha==='undefined'){resolve('not-loaded');return;}grecaptcha.ready(function(){grecaptcha.execute(MG.recaptchaSiteKey,{action:'quiz_submit'}).then(resolve).catch(function(){resolve('');});});});}

    /* ================================================================
       WP REST SUBMISSION
       ================================================================ */
    function postToWP(payload){return getRecaptchaToken().then(function(token){payload.recaptcha_token=token;var h={'Content-Type':'application/json'};if(MG.nonce)h['X-WP-Nonce']=MG.nonce;return fetch(MG.restUrl,{method:'POST',headers:h,body:JSON.stringify(payload)});}).then(function(r){return r.json();});}

    function sendSubmitEmails(fd,tier,insights){
        var fullname=fd.get('fullname')||'';
        var pdf=generateResultsPDFBase64(fd,tier.title,tier.body,tier.goalLine,insights);
        var fn=fullname?'Magellan-Readiness-Results-'+fullname.replace(/\s+/g,'-')+'.pdf':'Magellan-Outsourcing-Readiness-Results.pdf';
        var ctas=(tier.ctas||[]).filter(function(c){return c.action!=='download';}).map(function(c){return{label:c.label,action:c.action};});
        postToWP({fullname:fullname,email:fd.get('email')||'',phone:itiInstance?itiInstance.getNumber():(fd.get('phone')||''),company:fd.get('company')||'',tier:tier.title,tier_body:tier.body,goal_line:tier.goalLine,goal_answer:fd.get('q14')||'',score:calcScore(fd),answers:extractAnswers(fd),insights:insights,ctas:ctas,pdf_base64:pdf,pdf_filename:fn})
            .then(function(r){console.log('[scorecard] OK:',r);}).catch(function(e){console.error('[scorecard] Error:',e);});
    }

    function sendCtaEmail(action,fd,tier){return postToWP({fullname:fd.get('fullname')||'',email:fd.get('email')||'',phone:itiInstance?itiInstance.getNumber():(fd.get('phone')||''),company:fd.get('company')||'',tier:tier.title,tier_body:'',goal_line:'',score:calcScore(fd),answers:{cta_action:action},insights:[],is_cta:true});}

    /* ================================================================
       POPUP
       ================================================================ */
    var _fd=null,_tier=null,_ins=null;

    function showCtaFeedback(action,ok){var id='cta-msg-'+action;if($('#'+id).length)return;var $m=$('<p>').attr('id',id).addClass(ok?'cta-feedback cta-feedback--ok':'cta-feedback cta-feedback--err').text(ok?'\u2713 Your request has been sent. We\'ll be in touch shortly.':'\u26A0 Something went wrong. Please try again.').appendTo('#popupContent');setTimeout(function(){$m.fadeOut(400,function(){$(this).remove();});},4000);}

    function handleCtaClick(action){
        if(!_fd||!_tier)return;
        if(action==='schedule'||action==='consult'){
            var $b=$('[data-action="'+action+'"]');$b.prop('disabled',true).text('Sending\u2026');
            sendCtaEmail(action,_fd,_tier).then(function(){$b.text('Sent!');showCtaFeedback(action,true);}).catch(function(){$b.prop('disabled',false).text(action==='schedule'?'Request your Strategy Call':'Book a Consultation');showCtaFeedback(action,false);});
        }else if(action==='download'){downloadReadinessGuide();}
    }

    function buildPopup(fd){
        var score=0,insights=[];
        SCORING_RULES.forEach(function(r){var x=r.cases[fd.get(r.field)]||r.cases['_'];score+=x.pts;insights.push(x.msg);});
        var tier=TIERS.find(function(t){return score>=t.min;});
        var goal=fd.get('q14'),auth=fd.get('q15'),$c=$('#popupContent').empty();
        _fd=fd;_tier=tier;_ins=insights;
        $('<h2>').text(tier.title).appendTo($c);
        $('<p>').text(insights.join(' ')).appendTo($c);
        $('<p>').append($('<strong>').text('Recommendation: ').append($('<br>')),document.createTextNode(tier.body)).appendTo($c);
        $('<p>').append(document.createTextNode('Since your primary goal is '),$('<strong>').text(goal),document.createTextNode(', '+tier.goalLine)).appendTo($c);
        if(auth!=='yes')$('<p>').append($('<strong>').text('Note: ').append($('<br>')),document.createTextNode('You may need buy-in from other decision-makers before proceeding.')).appendTo($c);
        var $br=$('<div>').addClass('cta-btn-row').appendTo($c);
        tier.ctas.forEach(function(cta){$('<button>').addClass('btn btn-primary me-2 mb-2').attr('data-action',cta.action).text(cta.label).on('click',function(){handleCtaClick(cta.action);}).appendTo($br);});
    }

    /* ================================================================
       BOOT
       ================================================================ */
    $(document).ready(function(){
        buildForm();
        var state={step:0,$clusters:$('.cluster')};
        state.$clusters.hide();state.$clusters.eq(0).show();updateNav(state.step,state.$clusters);

        // intl-tel-input — utils.js served from dist/vendor/
        var phoneEl=document.getElementById('phone');
        if(phoneEl&&typeof window.intlTelInput==='function'){
            itiInstance=window.intlTelInput(phoneEl,{
                initialCountry:'auto',separateDialCode:true,preferredCountries:['us','ph','au','gb'],
                geoIpLookup:function(cb){$.getJSON('https://ipapi.co/json').done(function(d){cb(d.country_code);}).fail(function(){cb('us');});},
                utilsScript:(MG.distBase||'')+'js/vendor/utils.js'
            });
        }

        $('#start-btn').on('click',function(){$('.landing-grid').fadeOut(250,function(){$('#quizWrapper').removeClass('d-none').hide().fadeIn(300);});});
        $('#back-btn').on('click',function(){$('#quizWrapper').addClass('d-none');$('.landing-grid').fadeIn(300);});
        $('#prevBtn,#prevBtnMobile').on('click',function(){goPrev(state);});
        $('#nextBtn,#nextBtnMobile').on('click',function(){goNext(state);});

        $('#quizForm')
            .on('change input','[required]',function(){if($(this).val())$(this).removeClass('is-invalid');})
            .on('change','.q4check',function(){if($('.q4check').is(':checked')){$('#q4error').addClass('d-none');$('.q4check').removeClass('is-invalid');}})
            .on('blur','#email',function(){var v=$(this).val().trim();if(!v)return;var $fb=$(this).next('.invalid-feedback');if(!isValidEmailFormat(v)){$(this).addClass('is-invalid');$fb.text('Please enter a valid email address.');}else if(isTestEmail(v)){$(this).addClass('is-invalid');$fb.text('Please use a real business email address.');}else{$(this).removeClass('is-invalid');$fb.text('');}})
            .on('blur','#phone',function(){if(!itiInstance||!$(this).val().trim())return;if(!itiInstance.isValidNumber()){$(this).addClass('is-invalid');$(this).closest('.col-12').find('.invalid-feedback').text('Please enter a valid phone number for the selected country.');}else{$(this).removeClass('is-invalid');}})
            .on('submit',function(e){
                e.preventDefault();if(!validateCluster(state.$clusters.eq(state.step)))return;
                var fd=new FormData(this);buildPopup(fd);sendSubmitEmails(fd,_tier,_ins);
                $('#overlay,#popup').removeClass('d-none');$('#popup').addClass('d-flex flex-column');$('#submitBtn').prop('disabled',true);
            });

        $('#closePopup').on('click',function(){$('#overlay,#popup').addClass('d-none');setTimeout(function(){window.location.href=window.location.origin;},3000);});
    });

}(jQuery));

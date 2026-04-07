<script setup lang="ts">
useHead({
  title: 'Terms & Conditions — illusion Arc.',
  meta: [
    {
      name: 'description',
      content:
        'Read Illusion Arc. Terms & Conditions: usage rules, tournament rules, IP rights, prohibited activities, liability, and contact details.'
    }
  ]
})

const lastUpdated = 'April 7, 2026'
const companyName = 'Illusion Arc.'
const siteUrl = 'https://www.illusionarc.com'
const phoneDisplay = '+8801329662037'
const phoneHref = 'tel:+8801329662037'
const email = 'admin@illusionarc.com'
const emailHref = `mailto:${email}`
</script>

<template>
  <UContainer class="py-12">
    <div class="w-full max-w-none">
      <div class="mx-auto w-full max-w-4xl">
        <header class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <h1 class="text-3xl md:text-5xl font-semibold tracking-tight text-black dark:text-white">
              Terms &amp; Conditions
            </h1>
            <p class="mt-2 text-black/70 dark:text-white/70">
              Last updated:
              <span class="font-medium text-black dark:text-white">{{ lastUpdated }}</span>
            </p>
          </div>
        </header>

        <div
          class="mt-8 space-y-6 leading-relaxed
                 text-black/75 dark:text-white/75
                 break-words [overflow-wrap:anywhere]
                 text-left md:text-justify"
        >
          <!-- Agreement -->
          <section class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
            <h2 class="text-xl font-semibold text-black dark:text-white">AGREEMENT TO OUR LEGAL TERMS</h2>

            <p class="mt-3">
              We are {{ companyName }} ("Company," "we," "us," "our"), a company registered in Bangladesh at
              Gulshan 1, Dhaka 1212, Bangladesh, Dhaka, Gulshan 1212.
            </p>

            <p class="mt-3">
              We operate the website <span class="font-medium">{{ siteUrl }}</span> (the "Site"), as well as any other
              related products and services that refer or link to these legal terms (the "Legal Terms") (collectively,
              the "Services").
            </p>

            <p class="mt-3">
              You can contact us by phone at
              <a :href="phoneHref" class="underline underline-offset-4 hover:opacity-100 opacity-90">
                {{ phoneDisplay }}
              </a>,
              email at
              <a :href="emailHref" class="underline underline-offset-4 hover:opacity-100 opacity-90">
                {{ email }}
              </a>,
              or by mail to Gulshan 1, Dhaka 1212, Bangladesh, Dhaka, Gulshan 1212, Bangladesh.
            </p>

            <p class="mt-3">
              These Legal Terms constitute a legally binding agreement made between you, whether personally or on behalf
              of an entity ("you") and {{ companyName }}, concerning your access to and use of the Services. You agree
              that by accessing the Services, you have read, understood, and agreed to be bound by all of these Legal
              Terms. IF YOU DO NOT AGREE WITH ALL OF THESE LEGAL TERMS, THEN YOU ARE EXPRESSLY PROHIBITED FROM USING THE
              SERVICES AND YOU MUST DISCONTINUE USE IMMEDIATELY.
            </p>

            <p class="mt-3">
              Supplemental terms and conditions or documents that may be posted on the Services from time to time are
              hereby expressly incorporated herein by reference. We reserve the right, in our sole discretion, to make
              changes or modifications to these Legal Terms at any time and for any reason. We will alert you about any
              changes by updating the "Last updated" date of these Legal Terms, and you waive any right to receive
              specific notice of each such change.
            </p>

            <p class="mt-3">
              The Services are intended for users who are at least 13 years of age. All users who are minors in the
              jurisdiction in which they reside (generally under the age of 18) must have the permission of, and be
              directly supervised by, their parent or guardian to use the Services. If you are a minor, you must have
              your parent or guardian read and agree to these Legal Terms prior to you using the Services.
            </p>

            <p class="mt-3">
              We recommend that you print a copy of these Legal Terms for your records.
            </p>
          </section>

          <!-- 1 -->
          <section class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
            <h2 class="text-xl font-semibold text-black dark:text-white">1. OUR SERVICES</h2>
            <p class="mt-3">
              The information provided when using the Services is not intended for distribution to or use by any person
              or entity in any jurisdiction or country where such distribution or use would be contrary to law or
              regulation or which would subject us to any registration requirement within such jurisdiction or country.
              Accordingly, those persons who choose to access the Services from other locations do so on their own
              initiative and are solely responsible for compliance with local laws, if and to the extent local laws are
              applicable.
            </p>
          </section>

          <!-- 2 -->
          <section class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
            <h2 class="text-xl font-semibold text-black dark:text-white">2. INTELLECTUAL PROPERTY RIGHTS</h2>

            <h3 class="mt-4 font-semibold text-black dark:text-white">Our intellectual property</h3>
            <p class="mt-2">
              We are the owner or the licensee of all intellectual property rights in our Services, including all source
              code, databases, functionality, software, website designs, audio, video, text, photographs, and graphics
              in the Services (collectively, the "Content"), as well as the trademarks, service marks, and logos
              contained therein (the "Marks").
            </p>

            <p class="mt-3">
              Our Content and Marks are protected by copyright and trademark laws (and various other intellectual
              property rights and unfair competition laws) and treaties around the world.
            </p>

            <p class="mt-3">
              The Content and Marks are provided in or through the Services "AS IS" for your personal, non-commercial use
              or internal business purpose only.
            </p>

            <h3 class="mt-4 font-semibold text-black dark:text-white">Your use of our Services</h3>
            <p class="mt-2">
              Subject to your compliance with these Legal Terms, including the "PROHIBITED ACTIVITIES" section below, we
              grant you a non-exclusive, non-transferable, revocable license to:
            </p>
            <ul class="mt-3 list-disc pl-6 space-y-1">
              <li>access the Services; and</li>
              <li>download or print a copy of any portion of the Content to which you have properly gained access,</li>
            </ul>
            <p class="mt-3">
              solely for your personal, non-commercial use or internal business purpose.
            </p>

            <p class="mt-3">
              Except as set out in this section or elsewhere in our Legal Terms, no part of the Services and no Content
              or Marks may be copied, reproduced, aggregated, republished, uploaded, posted, publicly displayed, encoded,
              translated, transmitted, distributed, sold, licensed, or otherwise exploited for any commercial purpose
              whatsoever, without our express prior written permission.
            </p>

            <p class="mt-3">
              If you wish to make any use of the Services, Content, or Marks other than as set out in this section or
              elsewhere in our Legal Terms, please address your request to:
              <a :href="emailHref" class="underline underline-offset-4 hover:opacity-100 opacity-90">{{ email }}</a>.
            </p>

            <p class="mt-3">
              We reserve all rights not expressly granted to you in and to the Services, Content, and Marks. Any breach
              of these Intellectual Property Rights will constitute a material breach of our Legal Terms and your right
              to use our Services will terminate immediately.
            </p>

            <h3 class="mt-4 font-semibold text-black dark:text-white">Your submissions and contributions</h3>
            <p class="mt-2">
              Please review this section and the "PROHIBITED ACTIVITIES" section carefully prior to using our Services to
              understand the (a) rights you give us and (b) obligations you have when you post or upload any content
              through the Services.
            </p>

            <p class="mt-3">
              <span class="font-semibold text-black dark:text-white">Submissions:</span>
              By directly sending us any question, comment, suggestion, idea, feedback, or other information about the
              Services ("Submissions"), you agree to assign to us all intellectual property rights in such Submission.
              You agree that we shall own this Submission and be entitled to its unrestricted use and dissemination for
              any lawful purpose, commercial or otherwise, without acknowledgment or compensation to you.
            </p>

            <p class="mt-3">
              <span class="font-semibold text-black dark:text-white">Contributions:</span>
              The Services may invite you to chat, contribute to, or participate in blogs, message boards, online forums,
              and other functionality during which you may create, submit, post, display, transmit, publish, distribute,
              or broadcast content and materials to us or through the Services ("Contributions").
            </p>

            <p class="mt-3">
              When you post Contributions, you grant us a license (including use of your name, trademarks, and logos):
              By posting any Contributions, you grant us an unrestricted, unlimited, irrevocable, perpetual,
              non-exclusive, transferable, royalty-free, fully-paid, worldwide right, and license to use, copy,
              reproduce, distribute, sell, resell, publish, broadcast, retitle, store, publicly perform, publicly display,
              reformat, translate, excerpt (in whole or in part), and exploit your Contributions for any purpose,
              commercial, advertising, or otherwise, and to prepare derivative works of, or incorporate into other works,
              and to sublicense the licenses granted in this section.
            </p>

            <p class="mt-3">
              You are responsible for what you post or upload. You confirm you will not post or transmit illegal,
              harassing, hateful, harmful, defamatory, obscene, bullying, abusive, discriminatory, threatening,
              sexually explicit, false, inaccurate, deceitful, or misleading content; and you warrant you have rights to
              share your Submissions/Contributions.
            </p>

            <p class="mt-3">
              We may remove or edit your Content: Although we have no obligation to monitor any Contributions, we shall
              have the right to remove or edit any Contributions at any time without notice if in our reasonable opinion
              we consider such Contributions harmful or in breach of these Legal Terms.
            </p>

            <p class="mt-3">
              Copyright infringement: We respect the intellectual property rights of others. If you believe that any
              material available on or through the Services infringes upon any copyright you own or control, please
              immediately refer to the "COPYRIGHT INFRINGEMENTS" section below.
            </p>
          </section>

          <!-- 3 -->
          <section class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
            <h2 class="text-xl font-semibold text-black dark:text-white">3. USER REPRESENTATIONS</h2>
            <p class="mt-3">
              By using the Services, you represent and warrant that: (1) all registration information you submit will be
              true, accurate, current, and complete; (2) you will maintain the accuracy of such information and promptly
              update such registration information as necessary; (3) you have the legal capacity and you agree to comply
              with these Legal Terms; (4) you are not under the age of 13; (5) if you are a minor, you have received
              parental permission to use the Services; (6) you will not access the Services through automated or
              non-human means; (7) you will not use the Services for any illegal or unauthorized purpose; and (8) your
              use of the Services will not violate any applicable law or regulation.
            </p>
          </section>

          <!-- 4 -->
          <section class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
            <h2 class="text-xl font-semibold text-black dark:text-white">4. USER REGISTRATION</h2>
            <p class="mt-3">
              You may be required to register to use the Services. You agree to keep your password confidential and will
              be responsible for all use of your account and password. We reserve the right to remove, reclaim, or change
              a username you select if we determine, in our sole discretion, that such username is inappropriate, obscene,
              or otherwise objectionable.
            </p>
          </section>

          <!-- 5 -->
          <section class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
            <h2 class="text-xl font-semibold text-black dark:text-white">5. PRODUCTS</h2>
            <p class="mt-3">
              All products are subject to availability. We reserve the right to discontinue any products at any time for
              any reason. Prices for all products are subject to change.
            </p>
          </section>

          <!-- 6 -->
          <section class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
            <h2 class="text-xl font-semibold text-black dark:text-white">6. PURCHASES AND PAYMENT</h2>
            <p class="mt-3">
              We accept the following forms of payment: Visa. You agree to provide current, complete, and accurate
              purchase and account information for all purchases made via the Services. You further agree to promptly
              update account and payment information as needed. Sales tax may be added as required. We may change prices
              at any time. All payments shall be in BDT.
            </p>
          </section>

          <!-- 7 -->
          <section class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
            <h2 class="text-xl font-semibold text-black dark:text-white">7. REFUND POLICY</h2>
            <p class="mt-3">All sales are final and no refund will be issued.</p>
          </section>

          <!-- 8 -->
          <section class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
            <h2 class="text-xl font-semibold text-black dark:text-white">8. PROHIBITED ACTIVITIES</h2>
            <p class="mt-3">
              You may not access or use the Services for any purpose other than that for which we make the Services
              available. As a user of the Services, you agree not to engage in prohibited activities including, but not
              limited to:
            </p>
            <ul class="mt-3 list-disc pl-6 space-y-1">
              <li>Scraping, collecting, or systematically retrieving data without permission.</li>
              <li>Tricking, defrauding, or attempting to learn sensitive account information.</li>
              <li>Circumventing or disabling security-related features.</li>
              <li>Uploading viruses, spam, or harmful code/material.</li>
              <li>Automated use of the system (bots, scripts, data mining tools).</li>
              <li>Impersonating others or misusing usernames.</li>
              <li>Harassing, intimidating, or threatening users or staff.</li>
              <li>Reverse engineering or copying the Services’ software except as permitted by law.</li>
              <li>Using the Services to compete with us or for unauthorized commercial purposes.</li>
            </ul>
          </section>

          <!-- 9 Tournament Terms -->
          <section class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
            <h2 class="text-xl font-semibold text-black dark:text-white">9. TOURNAMENT TERMS</h2>

            <p class="mt-3">
              Additional rules may apply to tournaments, leaderboard events, special campaigns, prize-based gameplay,
              and other competitive activities offered through the Services. By participating in any tournament or
              competitive event, you agree to follow all event-specific rules, eligibility requirements, prize conditions,
              and verification procedures announced by {{ companyName }}.
            </p>

            <p class="mt-3">
              We actively monitor gameplay and account activity for unusual or suspicious behavior. Any exploit attempt,
              device manipulation, score manipulation, unauthorized method of play, account sharing, use of another
              person's ID, or allowing another person to use your ID may result in immediate action at our sole
              discretion.
            </p>

            <p class="mt-3">
              Such action may include score reset, score disqualification, removal from a tournament, cancellation of
              participation, withholding of rewards pending review, temporary suspension, or permanent ban from the
              Services.
            </p>

            <p class="mt-3">
              If required for prize verification or claim review, participants must be able to provide reasonable proof
              of valid gameplay. We strongly advise all tournament participants to keep their payment invoice, highest
              score gameplay screenshot, and full screen recording of the relevant gameplay session until prize
              distribution or claim verification is fully completed.
            </p>

            <p class="mt-3">
              Failure to provide requested verification materials within the required time may affect prize eligibility,
              reward processing, or final tournament standing. {{ companyName }} reserves the right to make the final
              decision on tournament integrity, verification, disqualification, and reward eligibility.
            </p>
          </section>

          <!-- 10 -->
          <section class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
            <h2 class="text-xl font-semibold text-black dark:text-white">10. USER GENERATED CONTRIBUTIONS</h2>
            <p class="mt-3">
              The Services may invite you to create, submit, post, display, transmit, publish, distribute, or broadcast
              content and materials ("Contributions"). Contributions may be viewable by other users and through
              third-party websites and may be treated as non-confidential and non-proprietary.
            </p>
          </section>

          <!-- 11 -->
          <section class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
            <h2 class="text-xl font-semibold text-black dark:text-white">11. CONTRIBUTION LICENSE</h2>
            <p class="mt-3">
              By posting your Contributions, you grant us an unrestricted, unlimited, irrevocable, perpetual,
              non-exclusive, transferable, royalty-free, fully-paid, worldwide right and license to use, host, copy,
              reproduce, disclose, sell, resell, publish, broadcast, retitle, archive, store, publicly perform, publicly
              display, reformat, translate, transmit, excerpt, and distribute such Contributions for any purpose.
            </p>
          </section>

          <!-- 12 -->
          <section class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
            <h2 class="text-xl font-semibold text-black dark:text-white">12. GUIDELINES FOR REVIEWS</h2>
            <p class="mt-3">
              If we provide areas to leave reviews, you must comply with rules such as: having firsthand experience,
              avoiding offensive/hate language, avoiding discriminatory references, avoiding illegal references, and not
              posting false or misleading statements. We may accept, reject, or remove reviews at our discretion.
            </p>
          </section>

          <!-- 13 -->
          <section class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
            <h2 class="text-xl font-semibold text-black dark:text-white">13. SOCIAL MEDIA</h2>
            <p class="mt-3">
              You may link your account with third-party accounts. You represent that you are entitled to provide login
              information and grant access under applicable terms.
            </p>
          </section>

          <!-- 14 -->
          <section class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
            <h2 class="text-xl font-semibold text-black dark:text-white">14. SERVICES MANAGEMENT</h2>
            <p class="mt-3">
              We reserve the right (but not the obligation) to monitor the Services for violations, take legal action,
              restrict access, remove excessive/burdensome content, and manage the Services to protect our rights and
              ensure proper functioning.
            </p>
          </section>

          <!-- 15 -->
          <section class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
            <h2 class="text-xl font-semibold text-black dark:text-white">15. PRIVACY POLICY</h2>
            <p class="mt-3">
              We care about data privacy and security. Please review our Privacy Policy:
              <span class="font-medium">https://www.illusionarc.com/privacy-policy</span>. By using the Services, you agree to be
              bound by our Privacy Policy, which is incorporated into these Legal Terms. The Services are hosted in
              Bangladesh; if you access from another region, you agree your data may be transferred to and processed in
              Bangladesh.
            </p>
          </section>

          <!-- 16 -->
          <section class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
            <h2 class="text-xl font-semibold text-black dark:text-white">16. COPYRIGHT INFRINGEMENTS</h2>
            <p class="mt-3">
              We respect the intellectual property rights of others. If you believe material on or through the Services
              infringes a copyright you own or control, please notify us using the contact information below.
            </p>
          </section>

          <!-- 17 -->
          <section class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
            <h2 class="text-xl font-semibold text-black dark:text-white">17. TERM AND TERMINATION</h2>
            <p class="mt-3">
              These Legal Terms remain in effect while you use the Services. We reserve the right to deny access to and
              use of the Services (including blocking certain IP addresses) for any reason, including breach of these
              Legal Terms, and may terminate your use or delete your account at any time without warning.
            </p>
          </section>

          <!-- 18 -->
          <section class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
            <h2 class="text-xl font-semibold text-black dark:text-white">18. MODIFICATIONS AND INTERRUPTIONS</h2>
            <p class="mt-3">
              We reserve the right to change, modify, or remove content at any time. We may modify or discontinue all or
              part of the Services without notice. We will not be liable for any modification, price change, suspension,
              or discontinuance of the Services.
            </p>
          </section>

          <!-- 19 -->
          <section class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
            <h2 class="text-xl font-semibold text-black dark:text-white">19. GOVERNING LAW</h2>
            <p class="mt-3">
              These Legal Terms shall be governed by the laws of Bangladesh. {{ companyName }} and you irrevocably consent
              that the courts of Bangladesh shall have exclusive jurisdiction to resolve any dispute which may arise in
              connection with these Legal Terms.
            </p>
          </section>

          <!-- 20 -->
          <section class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
            <h2 class="text-xl font-semibold text-black dark:text-white">20. DISPUTE RESOLUTION</h2>
            <p class="mt-3 font-semibold text-black dark:text-white">Binding Arbitration</p>
            <p class="mt-2">
              Any dispute arising out of or in connection with this contract shall be referred to and finally resolved by
              the International Commercial Arbitration Court under the European Arbitration Chamber (Belgium, Brussels,
              Avenue Louise, 146) according to the Rules of this ICAC. The number of arbitrators shall be one (1). The
              seat of arbitration shall be Dhaka, Bangladesh. The language of the proceedings shall be Bengali. The
              governing law shall be the substantive law of Bangladesh.
            </p>
            <p class="mt-3 font-semibold text-black dark:text-white">Restrictions</p>
            <p class="mt-2">
              Arbitration is limited to disputes between the parties individually. No class actions or representative
              proceedings are permitted to the fullest extent allowed by law.
            </p>
          </section>

          <!-- 21 -->
          <section class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
            <h2 class="text-xl font-semibold text-black dark:text-white">21. CORRECTIONS</h2>
            <p class="mt-3">
              There may be information on the Services that contains errors or omissions. We reserve the right to correct
              any errors and update the information at any time without prior notice.
            </p>
          </section>

          <!-- 22 -->
          <section class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
            <h2 class="text-xl font-semibold text-black dark:text-white">22. DISCLAIMER</h2>
            <p class="mt-3">
              THE SERVICES ARE PROVIDED ON AN AS-IS AND AS-AVAILABLE BASIS. YOU AGREE THAT YOUR USE OF THE SERVICES WILL
              BE AT YOUR SOLE RISK. TO THE FULLEST EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED,
              INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
            </p>
          </section>

          <!-- 23 -->
          <section class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
            <h2 class="text-xl font-semibold text-black dark:text-white">23. LIMITATIONS OF LIABILITY</h2>
            <p class="mt-3">
              IN NO EVENT WILL WE OR OUR DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE FOR ANY DIRECT, INDIRECT,
              CONSEQUENTIAL, EXEMPLARY, INCIDENTAL, SPECIAL, OR PUNITIVE DAMAGES, INCLUDING LOST PROFIT, LOST REVENUE,
              LOSS OF DATA, OR OTHER DAMAGES ARISING FROM YOUR USE OF THE SERVICES.
            </p>
          </section>

          <!-- 24 -->
          <section class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
            <h2 class="text-xl font-semibold text-black dark:text-white">24. INDEMNIFICATION</h2>
            <p class="mt-3">
              You agree to defend, indemnify, and hold us harmless, including our subsidiaries, affiliates, and officers,
              agents, partners, and employees, from losses, damages, liabilities, claims, and expenses arising from your
              use of the Services, breach of these Legal Terms, violation of third-party rights, or harmful acts toward
              other users.
            </p>
          </section>

          <!-- 25 -->
          <section class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
            <h2 class="text-xl font-semibold text-black dark:text-white">25. USER DATA</h2>
            <p class="mt-3">
              We will maintain certain data you transmit to the Services to manage performance. You are solely
              responsible for data you transmit or related activity. We are not liable for loss or corruption of such
              data.
            </p>
          </section>

          <!-- 26 -->
          <section class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
            <h2 class="text-xl font-semibold text-black dark:text-white">26. ELECTRONIC COMMUNICATIONS</h2>
            <p class="mt-3">
              Visiting the Services, sending emails, and completing online forms constitute electronic communications.
              You consent to receive electronic communications and agree electronic communications satisfy legal
              requirements for writing. You agree to the use of electronic signatures and delivery of notices.
            </p>
          </section>

          <!-- 27 -->
          <section class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-5">
            <h2 class="text-xl font-semibold text-black dark:text-white">27. MISCELLANEOUS</h2>
            <p class="mt-3">
              These Legal Terms and any policies posted constitute the entire agreement. Failure to enforce any right is
              not a waiver. We may assign rights/obligations. If any provision is unlawful or unenforceable, it is
              severed and the remainder remains effective.
            </p>
          </section>

          <!-- 28 Contact -->
          <section class="rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/5 backdrop-blur p-5">
            <h2 class="text-xl font-semibold text-black dark:text-white">28. CONTACT US</h2>

            <p class="mt-3">
              In order to resolve a complaint regarding the Services or to receive further information regarding use of
              the Services, please contact us at:
            </p>

            <div class="mt-4 grid gap-2 text-sm">
              <div class="font-medium text-black dark:text-white">{{ companyName }}</div>
              <div>Gulshan 1, Dhaka 1212, Bangladesh</div>
              <div>Dhaka, Gulshan 1212</div>
              <div>Bangladesh</div>

              <div class="pt-2">
                <span class="font-medium text-black dark:text-white">Phone:</span>
                <a :href="phoneHref" class="ml-2 underline underline-offset-4 hover:opacity-100 opacity-90">
                  {{ phoneDisplay }}
                </a>
              </div>

              <div>
                <span class="font-medium text-black dark:text-white">Email:</span>
                <a :href="emailHref" class="ml-2 underline underline-offset-4 hover:opacity-100 opacity-90">
                  {{ email }}
                </a>
              </div>
            </div>
          </section>

          <div class="pt-2 text-xs text-black/50 dark:text-white/50">
            Last updated: {{ lastUpdated }}
          </div>
        </div>
      </div>
    </div>
  </UContainer>
</template>
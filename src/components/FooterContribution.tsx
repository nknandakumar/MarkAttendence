'use client';

import { ArrowRight } from 'lucide-react';

export default function FooterContribution() {
  return (
    <div className="text-center space-y-2 pt-2 pb-4">
      <p className="text-xs text-[#737373] max-w-sm mx-auto leading-relaxed">
        Have suggestions, feature requests, or want to contribute?{' '}
        <br />
        Connect with{' '}
        <a
          href="https://www.linkedin.com/in/nandakumarm-/"
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex items-center gap-0.5  text-[#0a0a0a] hover:text-[#2385EB] underline  group-hover:decoration-[#2385EB] underline-offset-4 cursor-pointer"
        >
          <span> Nanda Kumar M</span>
          <ArrowRight className="w-3.5 h-3.5  transition-transform duration-200 -rotate-45 group-hover:rotate-0 shrink-0" />
        </a>
      </p>
    </div>
  );
}

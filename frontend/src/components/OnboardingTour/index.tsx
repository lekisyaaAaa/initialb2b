import React, { useEffect } from 'react';
import introJs from 'intro.js';
import 'intro.js/introjs.css';

type Step = {
  element?: string;
  intro: string;
  title?: string;
};

type Props = {
  steps: Step[];
  storageKey?: string;
};

const OnboardingTour: React.FC<Props> = ({ steps, storageKey = 'onboarding_seen' }) => {
  useEffect(() => {
    let intro: any;
    try {
      const seen = localStorage.getItem(storageKey);
      if (!seen) {
        intro = introJs();
        // map steps to intro.js format
        intro.setOptions({
          steps: steps.map(s => ({
            element: s.element || undefined,
            intro: s.intro,
            title: s.title,
          })),
          showProgress: true,
          showStepNumbers: true,
          exitOnOverlayClick: false,
          nextLabel: 'Next',
          prevLabel: 'Back',
          skipLabel: 'Skip tour',
          doneLabel: 'Done',
        });
        intro.start();
        intro.oncomplete(() => {
          try { localStorage.setItem(storageKey, '1'); } catch (e) {}
        });
        intro.onexit(() => {
          try { localStorage.setItem(storageKey, '1'); } catch (e) {}
        });
      }
    } catch (e) {
      // ignore storage or intro errors
    }

    return () => {
      try {
        if (intro && intro.exit) intro.exit();
      } catch (e) {}
    };
  }, [steps, storageKey]);

  return null;
};

export default OnboardingTour;

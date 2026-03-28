import { useEffect, useState } from 'react';
import { useStore } from './stores/useStore';
import ProfileSetup from './components/onboarding/ProfileSetup';
import ExerciseSetup from './components/onboarding/ExerciseSetup';
import SessionView from './components/training/SessionView';
import ActiveSession from './components/training/ActiveSession';
import ProgressScreen from './components/progress/ProgressScreen';
import SettingsScreen from './components/settings/SettingsScreen';
import BottomNav from './components/common/BottomNav';

export default function App() {
  const init = useStore(s => s.init);
  const isOnboarding = useStore(s => s.isOnboarding);
  const user = useStore(s => s.user);
  const exercises = useStore(s => s.exercises);
  const activeView = useStore(s => s.activeView);
  const activeTrainingSession = useStore(s => s.activeTrainingSession);
  const [onboardingStep, setOnboardingStep] = useState<'profile' | 'exercises'>('profile');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    init().then(() => setReady(true));
  }, [init]);

  if (!ready) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--color-primary)]">Volume Optimizer</div>
        </div>
      </div>
    );
  }

  if (isOnboarding || !user) {
    return <ProfileSetup onNext={() => setOnboardingStep('exercises')} />;
  }

  if (onboardingStep === 'exercises' && exercises.length === 0) {
    return <ExerciseSetup onDone={() => setOnboardingStep('profile')} />;
  }

  if (activeTrainingSession && activeTrainingSession.exerciseId) {
    return <ActiveSession />;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeView === 'training' && <SessionView />}
        {activeView === 'progress' && <ProgressScreen />}
        {activeView === 'settings' && <SettingsScreen />}
      </div>
      <BottomNav />
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useStore } from './stores/useStore';
import ProfileSetup from './components/onboarding/ProfileSetup';
import ExerciseSetup from './components/onboarding/ExerciseSetup';
import SessionView from './components/training/SessionView';
import ActiveSession from './components/training/ActiveSession';
import ProgramSession from './components/training/ProgramSession';
import PreCheckin from './components/training/PreCheckin';
import ProgressScreen from './components/progress/ProgressScreen';
import SettingsScreen from './components/settings/SettingsScreen';
import BottomNav from './components/common/BottomNav';

export default function App() {
  const init = useStore(s => s.init);
  const isOnboarding = useStore(s => s.isOnboarding);
  const user = useStore(s => s.user);
  const exercises = useStore(s => s.exercises);
  const mesocycles = useStore(s => s.mesocycles);
  const programs = useStore(s => s.programs);
  const activeView = useStore(s => s.activeView);
  const activeTrainingSession = useStore(s => s.activeTrainingSession);
  const showPreCheckin = useStore(s => s.showPreCheckin);
  const startTrainingSession = useStore(s => s.startTrainingSession);
  const skipTraining = useStore(s => s.skipTraining);
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

  // Pre-workout checkin screen
  if (showPreCheckin) {
    // Determine the plan to show — from program or single exercise
    const programId = showPreCheckin.programId;
    const exerciseId = showPreCheckin.exerciseId;
    const targetId = programId ?? exerciseId;

    let plan: import('./types').SessionPlan | undefined;
    let exerciseName = '';

    if (programId) {
      const prog = programs.find(p => p.id === programId);
      if (prog && prog.exerciseIds.length > 0) {
        const firstExId = prog.exerciseIds[0];
        const firstEx = exercises.find(e => e.id === firstExId);
        const meso = mesocycles.find(m => m.exerciseId === firstExId && m.status === 'active');
        if (meso && firstEx) {
          const week = meso.weeks[meso.currentWeek - 1];
          plan = week?.sessions.find(s => s.sessionNumber === meso.currentSession);
          exerciseName = prog.name;
        }
      }
    } else if (exerciseId) {
      const ex = exercises.find(e => e.id === exerciseId);
      const meso = mesocycles.find(m => m.exerciseId === exerciseId && m.status === 'active');
      if (ex && meso) {
        const week = meso.weeks[meso.currentWeek - 1];
        plan = week?.sessions.find(s => s.sessionNumber === meso.currentSession);
        exerciseName = ex.name;
      }
    }

    if (plan && targetId) {
      return (
        <PreCheckin
          plan={plan}
          exerciseName={exerciseName}
          onStart={(checkin, adjustedPlan, usedAdjustedPlan) => {
            startTrainingSession(targetId, checkin, adjustedPlan, usedAdjustedPlan);
          }}
          onSkip={skipTraining}
        />
      );
    }
  }

  // Active training session
  if (activeTrainingSession) {
    if (activeTrainingSession.programId) {
      return <ProgramSession />;
    }
    if (activeTrainingSession.exerciseId) {
      return <ActiveSession />;
    }
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

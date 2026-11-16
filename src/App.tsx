import { SocialVerseProvider } from './context/SocialVerseContext';
import { AuthWrapper } from './components/AuthWrapper';
import { AppShell } from './components/AppShell';

export default function App() {
  return (
    <SocialVerseProvider>
      <AuthWrapper>
        <AppShell />
      </AuthWrapper>
    </SocialVerseProvider>
  );
}

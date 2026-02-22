import { AppLayout } from './components/AppLayout';

function App() {

  const urlParams = new URLSearchParams(window.location.search);
  const role = (urlParams.get('role') || 'patient') as 'patient' | 'chew' | 'hospital';
  return <AppLayout initialRole={role} />;
}

export default App;

import { useAuth } from '@/context/AuthContext';
import TrainingAdminTab from '@/screens/TrainingAdminTab';
import TrainingUserTab from '@/screens/TrainingUserTab';

export default function TrainingTab() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  return isAdmin ? <TrainingAdminTab /> : <TrainingUserTab />;
}

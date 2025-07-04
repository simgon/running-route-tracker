import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, migrateAnonymousRoutesToUser } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // ルート移行処理
  const handleRouteMigration = async (user: User) => {
    try {
      const anonymousId = localStorage.getItem('anonymous_user_id');
      if (anonymousId) {
        console.log('Migrating routes from anonymous user:', anonymousId, 'to user:', user.id);
        
        const result = await migrateAnonymousRoutesToUser(user.id, anonymousId);
        
        if (result.migratedCount > 0) {
          console.log(`Successfully migrated ${result.migratedCount} routes`);
          
          // 移行完了後、anonymous_user_idをクリア
          localStorage.removeItem('anonymous_user_id');
          
          // 成功通知（オプション）
          // showToast(`${result.migratedCount}個のルートを引き継ぎました`, 'success');
        } else {
          console.log('No routes to migrate');
        }
      }
    } catch (error) {
      console.error('Failed to migrate routes:', error);
      // エラー通知（オプション）
      // showToast('ルートの引き継ぎに失敗しました', 'error');
    }
  };

  useEffect(() => {
    // 現在のセッションを取得
    const getSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Error getting session:', error);
      } else {
        setSession(session);
        setUser(session?.user ?? null);
      }
      setLoading(false);
    };

    getSession();

    // 認証状態の変更を監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        
        // 新規ログイン時に匿名ルートを移行
        if (event === 'SIGNED_IN' && session?.user) {
          await handleRouteMigration(session.user);
        }
        
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`
        }
      });
      if (error) throw error;
    } catch (error) {
      console.error('Error signing in with Google:', error);
      throw error;
    }
  };


  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  const value = {
    user,
    session,
    loading,
    signInWithGoogle,
    signOut
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
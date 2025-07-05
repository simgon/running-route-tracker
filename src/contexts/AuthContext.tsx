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
        // まず認証済みユーザーの既存ルート数を確認
        const { data: existingRoutes, error: checkError } = await supabase
          .from('running_routes')
          .select('id')
          .eq('user_id', user.id);

        if (checkError) {
          console.error('Error checking existing routes:', checkError);
          return;
        }

        // 既存ルートが0件の場合のみ引き継ぎを実施
        if (!existingRoutes || existingRoutes.length === 0) {
          console.log('No existing routes found. Migrating routes from anonymous user:', anonymousId, 'to user:', user.id);
          
          const result = await migrateAnonymousRoutesToUser(user.id, anonymousId);
          
          if (result.migratedCount > 0) {
            console.log(`Successfully migrated ${result.migratedCount} routes`);
            
            // 移行完了後、anonymous_user_idをクリア
            localStorage.removeItem('anonymous_user_id');
          } else {
            console.log('No routes to migrate');
          }
        } else {
          console.log(`User already has ${existingRoutes.length} routes. Skipping migration.`);
          // 既存ルートがある場合も匿名IDをクリア
          localStorage.removeItem('anonymous_user_id');
        }
      }
    } catch (error) {
      console.error('Failed to migrate routes:', error);
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
          redirectTo: process.env.NODE_ENV === 'production' 
            ? `${process.env.REACT_APP_PRODUCTION_URL || window.location.origin}/`
            : `${window.location.origin}/`
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
# Running Route Tracker 🏃‍♂️

GPS対応のランニングルート記録・編集Webアプリケーション

## 🌟 主な機能

- **GPS位置情報取得**: リアルタイムでランニングルートを記録
- **ルート編集**: ドラッグ&ドロップでルートポイントを編集
- **デモモード**: PC環境でのテスト用クリックモード
- **ルート保存・読み込み**: Supabaseを使用したクラウド保存
- **レスポンシブデザイン**: モバイル・デスクトップ対応
- **距離・時間・ペース計算**: リアルタイム統計表示

## 🛠️ 技術スタック

- **Frontend**: React 18 + TypeScript
- **地図**: Google Maps JavaScript API
- **Backend**: Supabase (PostgreSQL + 認証)
- **デプロイ**: Vercel
- **スタイリング**: CSS-in-JS

## 🚀 セットアップ

### 1. リポジトリのクローン

```bash
git clone https://github.com/simgon/running-route-tracker.git
cd running-route-tracker
```

### 2. 依存関係のインストール

```bash
npm install
```

### 3. 環境変数の設定

`.env.example`をコピーして`.env`ファイルを作成：

```bash
cp .env.example .env
```

`.env`ファイルに以下の値を設定：

```env
REACT_APP_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
REACT_APP_SUPABASE_URL=your_supabase_project_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Google Maps API キーの取得

1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. 新しいプロジェクトを作成またはプロジェクトを選択
3. Maps JavaScript APIを有効化
4. APIキーを作成し、必要に応じて制限を設定

### 5. Supabaseプロジェクトの設定

1. [Supabase](https://supabase.com/)でアカウント作成
2. 新しいプロジェクトを作成
3. 以下のSQLを実行してテーブルを作成：

```sql
-- ランニングルートテーブル
CREATE TABLE running_routes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  anonymous_user_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  distance NUMERIC NOT NULL,
  duration INTEGER,
  route_data JSONB NOT NULL,
  elevation_data NUMERIC[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS (Row Level Security) の有効化
ALTER TABLE running_routes ENABLE ROW LEVEL SECURITY;

-- 匿名ユーザー用のポリシー
CREATE POLICY "Allow anonymous users to manage their routes" ON running_routes
  FOR ALL USING (anonymous_user_id IS NOT NULL);
```

### 6. 開発サーバーの起動

```bash
npm start
```

http://localhost:3000 でアプリにアクセスできます。

## 📱 使用方法

### GPS記録モード (モバイル推奨)
1. **GPS開始**ボタンで位置情報取得を許可
2. **記録開始**でランニング開始
3. **一時停止/再開**で記録制御
4. **停止**後に**保存**でルートをクラウドに保存

### デモモード (PC環境)
1. **デモモード**に切り替え
2. **記録開始**後、地図をクリックしてルートを作成
3. 通常と同様に保存・編集が可能

### ルート編集
1. **保存済みルート**からルートを読み込み
2. **編集**ボタンで編集モードに切り替え
3. 編集操作：
   - **地図クリック**: 新しいピンを追加
   - **ルート線クリック**: 線上にピンを挿入
   - **ピンドラッグ**: 左クリックでピンを移動
   - **右クリック**: ピンを削除
4. **適用**で変更を確定

## 🚀 デプロイ

### Vercelでのデプロイ

1. [Vercel](https://vercel.com/)でアカウント作成
2. GitHubリポジトリを接続
3. 環境変数を設定：
   - `REACT_APP_GOOGLE_MAPS_API_KEY`
   - `REACT_APP_SUPABASE_URL`
   - `REACT_APP_SUPABASE_ANON_KEY`
4. デプロイ実行

## 📁 プロジェクト構造

```
src/
├── components/          # Reactコンポーネント
│   ├── GoogleMap.tsx   # Google Maps統合
│   ├── RouteList.tsx   # 保存済みルート一覧
│   └── SaveRouteModal.tsx # ルート保存モーダル
├── hooks/              # カスタムHooks
│   ├── useGeolocation.ts    # GPS位置情報
│   ├── useRunningRoute.ts   # ルート記録ロジック
│   └── useRouteStorage.ts   # データ保存・読み込み
├── lib/                # ライブラリ設定
│   └── supabase.ts     # Supabase設定
├── App.tsx             # メインアプリケーション
└── App.css             # スタイリング
```

## 🔧 開発

### 利用可能なスクリプト

- `npm start` - 開発サーバー起動
- `npm run build` - 本番用ビルド
- `npm test` - テスト実行
- `npm run eject` - Create React App設定のeject

### 主要な依存関係

- `@googlemaps/react-wrapper` - Google Maps React統合
- `@supabase/supabase-js` - Supabaseクライアント
- `@types/geojson` - GeoJSON型定義

## 🤝 コントリビューション

1. このリポジトリをフォーク
2. フィーチャーブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

## 📄 ライセンス

このプロジェクトはMITライセンスのもとで公開されています。

## 🙏 謝辞

このプロジェクトは[Claude Code](https://claude.ai/code)の支援により開発されました。

---

**Developed with ❤️ using React + TypeScript + Google Maps + Supabase**
import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Divider,
  Chip,
  Paper,
} from "@mui/material";
import {
  Help as HelpIcon,
  DirectionsRun,
  AddCircleOutline,
  RemoveCircleOutline,
  Polyline,
  ChangeCircle,
  SaveAlt,
  Cancel,
  Backspace,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  TouchApp,
  Mouse,
  Keyboard,
} from "@mui/icons-material";

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  const isMobile = window.innerWidth <= 768;

  const sections = [
    {
      title: "基本操作",
      icon: <TouchApp color="primary" />,
      items: [
        {
          action: "新規ルート作成",
          description: "「新規ルート作成」ボタンをクリックして地図をタップ・クリックでピンを配置",
          icon: <AddCircleOutline color="success" />
        },
        {
          action: "ルート選択",
          description: "ルートカードをクリックして表示・編集モードを切り替え",
          icon: <EditIcon color="warning" />
        },
        {
          action: "ルート保存",
          description: "ピン配置後に保存ボタンでルート名と時間を設定して保存",
          icon: <SaveAlt color="primary" />
        }
      ]
    },
    {
      title: "編集モード",
      icon: <EditIcon color="warning" />,
      items: [
        {
          action: "ピン追加",
          description: "十字マーク位置にピンを追加",
          icon: <AddCircleOutline color="success" />
        },
        {
          action: "ルート上に追加",
          description: "既存ルート線上の最適な位置にピンを挿入",
          icon: <Polyline color="info" />
        },
        {
          action: "ピン削除",
          description: "十字マーク近くのピンを削除",
          icon: <RemoveCircleOutline color="error" />
        },
        {
          action: "往復ルート",
          description: "ピンをクリック・ダブルクリックで往復ルートを自動生成",
          icon: <Polyline color="secondary" />
        }
      ]
    },
    {
      title: "ピン操作",
      icon: <Mouse color="info" />,
      items: [
        {
          action: isMobile ? "ロングタップ→ドラッグ" : "ロングクリック→ドラッグ",
          description: `ピンを${isMobile ? "長押し" : "長押し"}してドラッグで位置変更`,
          icon: <TouchApp color="primary" />
        },
        {
          action: isMobile ? "1.5秒ロングタップ" : "1.5秒ロングクリック",
          description: "ピンを削除",
          icon: <DeleteIcon color="error" />
        },
        {
          action: isMobile ? "右クリック" : "右クリック",
          description: "コンテキストメニューでピン削除",
          icon: <DeleteIcon color="error" />
        },
        {
          action: "ダブルクリック",
          description: "往復ルート（そのピンまでの往復）を追加",
          icon: <Polyline color="secondary" />
        }
      ]
    },
    {
      title: "キーボードショートカット",
      icon: <Keyboard color="info" />,
      items: [
        {
          action: "← → 矢印キー",
          description: "ルート選択を切り替え（編集モード時は無効）",
          icon: <Keyboard color="info" />
        }
      ]
    },
    {
      title: "ルート管理",
      icon: <DirectionsRun color="primary" />,
      items: [
        {
          action: "表示/非表示切り替え",
          description: "目のアイコンでルートの表示・非表示を切り替え",
          icon: <VisibilityIcon color="success" />
        },
        {
          action: "ルート編集",
          description: "編集アイコンでルート名・説明・時間を変更",
          icon: <EditIcon color="warning" />
        },
        {
          action: "ルート削除",
          description: "削除アイコンでルートを完全削除",
          icon: <DeleteIcon color="error" />
        },
        {
          action: "ドラッグ&ドロップ",
          description: "ドラッグハンドルでルートの順序を変更",
          icon: <TouchApp color="info" />
        }
      ]
    },
    {
      title: "編集ボタン",
      icon: <ChangeCircle color="success" />,
      items: [
        {
          action: "保存",
          description: "編集内容を保存（編集モード時は変更を適用）",
          icon: <SaveAlt color="primary" />
        },
        {
          action: "モード切り替え",
          description: "追加→ルート上追加→削除→往復の順で編集モードを切り替え",
          icon: <ChangeCircle color="success" />
        },
        {
          action: "末尾削除",
          description: "最後に追加したピンを削除",
          icon: <Backspace color="warning" />
        },
        {
          action: "キャンセル",
          description: "編集・作成モードを終了",
          icon: <Cancel color="error" />
        }
      ]
    }
  ];

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      fullScreen={isMobile}
      slotProps={{
        paper: {
          sx: {
            borderRadius: isMobile ? 0 : 2,
            maxHeight: isMobile ? "100vh" : "90vh",
          },
        },
      }}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, pb: 1 }}>
        <HelpIcon color="primary" />
        <Typography variant="h5" component="span">
          操作方法ガイド
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ pb: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          ランメモの基本的な操作方法と機能について説明します。
        </Typography>

        {sections.map((section, sectionIndex) => (
          <Box key={sectionIndex} sx={{ mb: 3 }}>
            <Paper
              elevation={1}
              sx={{
                p: 2,
                backgroundColor: "grey.50",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                {section.icon}
                <Typography variant="h6" fontWeight="bold" color="primary.main">
                  {section.title}
                </Typography>
              </Box>

              {section.items.map((item, itemIndex) => (
                <Box key={itemIndex}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 2,
                      py: 1.5,
                    }}
                  >
                    <Box sx={{ mt: 0.5 }}>{item.icon}</Box>
                    <Box sx={{ flex: 1 }}>
                      <Chip
                        label={item.action}
                        size="small"
                        variant="outlined"
                        sx={{
                          mb: 0.5,
                          fontWeight: "bold",
                          fontSize: "0.75rem",
                        }}
                      />
                      <Typography variant="body2" color="text.secondary">
                        {item.description}
                      </Typography>
                    </Box>
                  </Box>
                  {itemIndex < section.items.length - 1 && (
                    <Divider sx={{ my: 0.5, opacity: 0.3 }} />
                  )}
                </Box>
              ))}
            </Paper>
          </Box>
        ))}

        <Paper
          elevation={2}
          sx={{
            p: 2,
            backgroundColor: "primary.light",
            color: "primary.contrastText",
            mt: 2,
          }}
        >
          <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>
            💡 ヒント
          </Typography>
          <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
            • 地図を拡大すると距離ラベルがより詳細に表示されます
            <br />
            • ルートは自動的にクラウドに保存され、どのデバイスからでもアクセスできます
            <br />
            • AIルート生成機能で目的地を指定した最適なルートを自動作成できます
            <br />
            • ルートコピー機能で既存ルートをベースに新しいルートを作成できます
          </Typography>
        </Paper>
      </DialogContent>

      <Divider />

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} variant="contained" color="primary" fullWidth={isMobile}>
          閉じる
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default HelpModal;
# -*- coding: utf-8 -*-
"""
広場だより一括リネームスクリプト
================================
Google Driveからダウンロードしたファイルを
「番号.拡張子」（例: 077.pdf, 184.png）に統一します。

使い方:
 1. Google Driveのフォルダを右クリック→ダウンロード（ZIPで落ちてくる）
 2. ZIPを解凍する
 3. このスクリプトを解凍したフォルダの中に置く
 4. ダブルクリック、またはコマンドで python rename_tayori.py を実行
 5. 「renamed」フォルダに整理済みファイルができます
"""
import os
import re
import shutil

SRC = os.path.dirname(os.path.abspath(__file__))
DST = os.path.join(SRC, "renamed")
os.makedirs(DST, exist_ok=True)

count = 0
skipped = []

for name in os.listdir(SRC):
    path = os.path.join(SRC, name)
    if not os.path.isfile(path) or name == os.path.basename(__file__):
        continue

    # ファイル名の先頭の数字（2〜3桁）を拾う
    m = re.match(r"\s*(\d{2,3})", name)
    if not m:
        skipped.append(name)
        continue

    num = int(m.group(1))

    # 拡張子判定（.png が含まれていればPNG、それ以外はPDF扱い）
    ext = "png" if ".png" in name.lower() else "pdf"

    newname = f"{num:03d}.{ext}"
    shutil.copy2(path, os.path.join(DST, newname))
    count += 1
    print(f"{name}  →  {newname}")

print(f"\n完了: {count}件を renamed フォルダに保存しました")
if skipped:
    print("スキップ（番号が読めなかったファイル）:")
    for s in skipped:
        print(f"  - {s}")

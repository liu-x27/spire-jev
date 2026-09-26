"""Train value.ts's net: an MLP from an end-of-turn state's features to the bout's outcome score.

    <torch python> tools/train_value.py runs/value-data/iter0.jsonl [more.jsonl ...] --out data/value-net.json

Rows come from planner/src/valuegen.ts ({g: bout, x: features, y: outcome score 0-130, boss, turn, won}).
Bouts, not rows, are split into train and validation (a bout's turns are one outcome). The features are
standardized; the net is written as JSON (mean, std, layers of w and b) for value.ts's valueOf.
"""
import argparse
import json
import random

import torch
from torch import nn

ap = argparse.ArgumentParser()
ap.add_argument("files", nargs="+")
ap.add_argument("--out", default="data/value-net.json")
ap.add_argument("--hidden", type=int, nargs="+", default=[128, 64])
ap.add_argument("--epochs", type=int, default=40)
ap.add_argument("--lr", type=float, default=2e-3)
ap.add_argument("--val", type=float, default=0.15)
ap.add_argument("--seed", type=int, default=1)
args = ap.parse_args()
random.seed(args.seed)
torch.manual_seed(args.seed)

rows = []
for i, f in enumerate(args.files):
    with open(f, encoding="utf-8") as fh:
        for line in fh:
            r = json.loads(line)
            r["g"] = f"{i}:{r['g']}"
            rows.append(r)
bouts = sorted({r["g"] for r in rows})
random.shuffle(bouts)
val_bouts = set(bouts[: int(len(bouts) * args.val)])
train = [r for r in rows if r["g"] not in val_bouts]
val = [r for r in rows if r["g"] in val_bouts]
print(f"{len(rows)} rows, {len(bouts)} bouts; train {len(train)}, validation {len(val)}")

dev = "cuda" if torch.cuda.is_available() else "cpu"
X = torch.tensor([r["x"] for r in train], dtype=torch.float32)
Y = torch.tensor([r["y"] for r in train], dtype=torch.float32).unsqueeze(1)
Xv = torch.tensor([r["x"] for r in val], dtype=torch.float32)
Yv = torch.tensor([r["y"] for r in val], dtype=torch.float32).unsqueeze(1)
mean = X.mean(0)
std = X.std(0).clamp_min(1e-6)
norm = lambda t: (t - mean) / std

layers = []
width = X.shape[1]
for h in args.hidden:
    layers += [nn.Linear(width, h), nn.ReLU()]
    width = h
layers.append(nn.Linear(width, 1))
model = nn.Sequential(*layers).to(dev)
opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
Xn, Yd, Xvn, Yvd = norm(X).to(dev), Y.to(dev), norm(Xv).to(dev), Yv.to(dev)
base = ((Yvd - Yd.mean()) ** 2).mean().sqrt().item()
batch = 512
for epoch in range(args.epochs):
    model.train()
    perm = torch.randperm(len(Xn), device=dev)
    for k in range(0, len(Xn), batch):
        idx = perm[k : k + batch]
        loss = nn.functional.mse_loss(model(Xn[idx]), Yd[idx])
        opt.zero_grad()
        loss.backward()
        opt.step()
    if epoch % 5 == 4 or epoch == args.epochs - 1:
        model.eval()
        with torch.no_grad():
            rmse = ((model(Xvn) - Yvd) ** 2).mean().sqrt().item()
            # Does the net rank a won bout's states over a lost one's? (the planner needs the order)
            pv = model(Xvn).squeeze(1)
            won = torch.tensor([r["won"] for r in val], device=dev) > 0
            auc = (pv[won].unsqueeze(1) > pv[~won].unsqueeze(0)).float().mean().item() if won.any() and (~won).any() else float("nan")
        print(f"epoch {epoch + 1}: validation RMSE {rmse:.2f} (a constant's {base:.2f}), won-over-lost ranking {auc:.3f}")

model = model.cpu()
lin = [m for m in model if isinstance(m, nn.Linear)]
net = {
    "mean": mean.tolist(),
    "std": std.tolist(),
    "layers": [{"w": m.weight.detach().tolist(), "b": m.bias.detach().tolist()} for m in lin],
}
with open(args.out, "w", encoding="utf-8") as fh:
    json.dump(net, fh)
print(f"→ {args.out}")

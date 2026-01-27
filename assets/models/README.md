# MobileFaceNet Model

Place your `MobileFaceNet.onnx` model file in this directory.

## Requirements

- File name: `MobileFaceNet.onnx`
- Maximum size: 10MB
- Format: ONNX
- Input shape: [1, 3, 112, 112] (NCHW format)
- Input type: float32
- Output: Embedding vector (typically 128 or 256 dimensions)

## Where to get the model

You can train or download MobileFaceNet from:

- Original paper: https://arxiv.org/abs/1804.07573
- ONNX Model Zoo: https://github.com/onnx/models
- Train your own using popular face recognition frameworks

## Model Conversion

If you have a PyTorch or TensorFlow model, convert to ONNX:

### PyTorch to ONNX

```python
import torch
import torch.onnx

model = MobileFaceNet()
model.load_state_dict(torch.load('mobilefacenet.pth'))
model.eval()

dummy_input = torch.randn(1, 3, 112, 112)
torch.onnx.export(
    model,
    dummy_input,
    "MobileFaceNet.onnx",
    input_names=['input'],
    output_names=['output'],
    dynamic_axes={'input': {0: 'batch'}, 'output': {0: 'batch'}}
)
```

### TensorFlow to ONNX

```bash
pip install tf2onnx
python -m tf2onnx.convert --saved-model tensorflow_model/ --output MobileFaceNet.onnx
```

## Validation

After placing the model here, run:

```bash
npm run check-model
```

This will verify:

- File exists
- Size is within limit (≤ 10MB)

## Note

The model file is excluded from git due to size constraints. Each device must have the model file placed manually or downloaded during setup.

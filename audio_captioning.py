import pickle
from typing import OrderedDict
import librosa
import numpy as np
import wavetransformer.tools.model
from torch import Tensor, load as pt_load, device
import os
from clotho_dataset.features_log_mel_bands import feature_extraction
import wavetransformer.tools.file_io


def get_model():
  # Parameters for wave-transformer10 (from model_ht_12_37.yaml):
  params_model = {'in_channels_encoder':  64,
      'out_waveblock_encoder': [16,32,64,128],
      'kernel_size_encoder': 3,
      'dilation_rates_encoder': [2,2,2,2],
      'inner_kernel_size_encoder': 5,
      'inner_padding_encoder': 2,
      'last_dim_encoder': 128,
      'pw_kernel_encoder': 5,
      'pw_padding_encoder': 2,
      'merge_mode_encoder': 'conv',

      'num_layers_decoder': 3,
      'num_heads_decoder': 4,
      'n_features_decoder': 128,
      'n_hidden_decoder': 128,
      'nb_classes': 4367, # number of words in "WT_words_list.p"
      'dropout_decoder': 0.25,
      'beam_size': 2}


  state_dict = pt_load(os.path.join('wavetransformer', 'outputs', 'models', 'best_model_43_3.pt'), map_location=device('cpu'))

  model = wavetransformer.tools.model.WaveTransformer10(**params_model)

  new_state_dict = OrderedDict()
  for k, v in state_dict.items():
      name = k.replace("module.", "")  # remove `module.`
      new_state_dict[name] = v

  # load params
  model.load_state_dict(new_state_dict)
  model.eval()
  return model

def handle_captioning(file, model):  
  y, sr_orig = librosa.load(file)
  y = [y]

  # Split the array until length of single subarray is less than 30s
  while y[0].size > sr_orig*30:
      newlist = []
      for array in y:
          newlist.append(np.array_split(array, 2, axis=0))
      y = newlist
      y = [item for sublist in y for item in sublist]
  
  subarray_length = int(y[0].size/sr_orig)

  # Get prediction for each part
  preds = []
  for arr in y:
      pred = get_prediction(model, arr, sr_orig)
      preds.append(pred)
  
  # Send the lenght of subarray as last element of predicted captions
  preds.append(subarray_length)
  
  return preds

def get_prediction(model, y, sr):
  params_feature_extraction= {'sr': 44100,
    'nb_fft': 1024,
    'hop_size': 512,
    'nb_mels': 64,
    'window_function': 'hann',
    'center': True,
    'f_min': 0.0,
    'f_max': None,
    'htk': False,
    'power': 1,
    'norm': 1}

  # Setting the sampling rate for feature extraction
  params_feature_extraction['sr'] = sr

  features = feature_extraction(audio_data=y, **params_feature_extraction)

  row = Tensor([features]).float()
  yhat = model(row, None)

  pth = os.path.join('wavetransformer', 'data', 'WT_pickles', 'WT_words_list.p')

  f = open(pth, 'rb')
  indices_object =  pickle.load(f, encoding='latin1')
  predicted_words = yhat
  predicted_caption = [indices_object[i.item()]
                        for i in predicted_words]
  predicted_caption = [ x for x in predicted_caption if "<" not in x ]
  predicted_caption = ' '.join(predicted_caption)
  return predicted_caption

  
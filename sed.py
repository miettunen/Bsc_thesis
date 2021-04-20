import numpy as np
import os
import librosa

# path added in app.py
import params 
import yamnet


def get_model_and_classes():
    parameters = params.Params()
    yamnet_model = yamnet.yamnet_frames_model(parameters)
    yamnet_model.load_weights(os.path.join('yamnet', 'yamnet.h5'))
    yamnet_classes = yamnet.class_names(os.path.join('yamnet', 'yamnet_class_map.csv'))
    return yamnet_model, yamnet_classes


def handle_sed_listen(file, model, classes, top_n):
    sound_array = preprocess_yamnet(file)

    score_matrix, labels = get_figure(sound_array, model, classes, top_n)
    score_matrix.append(labels)

    return score_matrix


def handle_sed_upload(file, model, classes, top_n):
    sound_array = preprocess_yamnet(file)
    score_matrix, labels = get_figure2(sound_array, model, classes, top_n)
    score_matrix.append(labels)
    return score_matrix

"""
Top predictions as (class, score) pairs
"""
def get_prediction(sound_array, model, classes, top_n):
    top_n = 5
    predictions, embeddings, log_mel_spectrogram = model(sound_array)
    clip_predictions = np.mean(predictions, axis=0)
    top_n_indices = np.argsort(clip_predictions)[-top_n:]
    top_n_scores = clip_predictions[top_n_indices]
    top_n_scores = [round(i, 2) for i in top_n_scores]
    top_n_class_names = classes[top_n_indices]
    top_n_predictions = list(zip(top_n_class_names, top_n_scores))
    r = '.'.join([str(a) for a in top_n_predictions])
    
    return r

"""
Top predictions as matrix and class labels, uses default framing
"""
def get_figure(sound_array, model, classes, top_n):
    predictions, embeddings, log_mel_spectrogram = model(sound_array)
    scores_np = predictions.numpy()
    mean_scores = np.mean(predictions, axis=0)
    top_class_indices = np.argsort(mean_scores)[::-1][:top_n]
    score_matrix = scores_np[:, top_class_indices].T
    scores = score_matrix.tolist()
    labels = classes[top_class_indices].tolist()
    return scores, labels

"""
Top predictions as matrix and class labels, uses 1 second frames and no overlap.
Uses only first 0.975s (yamnet default) of each frame.
"""
def get_figure2(sound_array, model, classes, top_n):
    fs = 16000
    pointer = fs
    first = True
    complete_data = 0
    while pointer < len(sound_array):
        array_part = sound_array[pointer-16000:pointer]
        predictions, embeddings, log_mel_spectrogram = model(array_part)
        predictions = predictions.numpy()
        predictions = predictions[0,:]
        if first:
            complete_data = np.expand_dims(predictions, 0)
            first = False
        else:
            predictions = np.expand_dims(predictions, 0)
            complete_data = np.append(complete_data, predictions, 0)
        pointer += fs

    scores_np = complete_data
    mean_scores = np.mean(scores_np, axis=0)
    top_class_indices = np.argsort(mean_scores)[::-1][:top_n]
    score_matrix = scores_np[:, top_class_indices].T
    scores = score_matrix.tolist()
    labels = classes[top_class_indices].tolist()
    return scores, labels


def preprocess_yamnet(file, sr=16000):
    y, sr_orig = librosa.load(file)        
    y = librosa.resample(y, sr_orig, sr)
    y = librosa.to_mono(y)
    return y
    
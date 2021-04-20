from flask import Flask, jsonify, request, render_template
import sys
import os

sys.path.append(os.path.join(sys.path[0],'clotho-dataset'))

sys.path.append(os.path.join(sys.path[0],'yamnet',))
from sed import get_model_and_classes as get_yamnet, handle_sed_listen, handle_sed_upload

sys.path.append(os.path.join(sys.path[0],'wavetransformer'))
from audio_captioning import get_model as get_wt10, handle_captioning





app = Flask(__name__)

wt10 = get_wt10()
yamnet_m, yamnet_c = get_yamnet()



@app.route('/caption', methods=['POST'])
def caption():  
    if request.method == 'POST':
        file = request.files['file']
        preds = handle_captioning(file, wt10)
        return jsonify(preds)

@app.route('/upload_sed', methods=['POST'])
def upload_sed():
    if request.method == 'POST':
        file = request.files['file']
        score_matrix = handle_sed_upload(file, yamnet_m, yamnet_c, 20)
        return jsonify(score_matrix)

@app.route('/listen', methods=['POST'])
def listen():  
    if request.method == 'POST':
        file = request.files['file']
        score_matrix = handle_sed_listen(file, yamnet_m, yamnet_c, 4)

        return jsonify(score_matrix)

@app.route('/')
def home():
    return render_template('introduction.html')

@app.route('/sed')
def sed():
    return render_template('sed.html')

@app.route('/audio_captioning')
def realtime():
    return render_template('audio_caption.html')

@app.route('/contacts')
def contacts():
    return render_template('contacts.html')


if __name__ == '__main__':
    app.run()
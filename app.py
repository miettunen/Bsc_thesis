from flask import Flask, jsonify, request, render_template
import sys
import os

sys.path.append(os.path.join(sys.path[0],'clotho-dataset'))

sys.path.append(os.path.join(sys.path[0],'yamnet',))
from sed import get_model_and_classes as get_yamnet, handle_sed_listen, handle_sed_upload

sys.path.append(os.path.join(sys.path[0],'wavetransformer'))
from audio_captioning import get_model as get_wt10, handle_captioning


app = Flask(__name__)

app.config['MAX_CONTENT_LENGTH'] = 15 * 1024 * 1024 # Limit uploads to 15 MiB

ALLOWED_EXTENSIONS = {'wav'}


def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


wt10 = get_wt10()
yamnet_m, yamnet_c = get_yamnet(patch_hop_seconds=1)



@app.route('/caption', methods=['POST'])
def caption():  
    if request.method == 'POST':

        file = request.files['file']

        if not allowed_file(file.filename):
            return jsonify({"error": "Only .wav files are supported",}), 415

        try:
            preds = handle_captioning(file, wt10)
            return jsonify(preds)
        except:
            return jsonify({"error": "Sent audio couldn't be processed",}), 400

@app.route('/upload_sed', methods=['POST'])
def upload_sed():
    if request.method == 'POST':

        file = request.files['file']

        if not allowed_file(file.filename):
            return jsonify({"error": "Only .wav files are supported",}), 415

        try:
            top_n = int(request.form['top_n'])
        except:
            top_n = 10

        try:
            score_matrix = handle_sed_upload(file, yamnet_m, yamnet_c, top_n)
            return jsonify(score_matrix)
        except:
            return jsonify({"error": "Sent audio couldn't be processed",}), 400

        

@app.route('/listen', methods=['POST'])
def listen():  
    if request.method == 'POST':
        file = request.files['file']
        if not allowed_file(file.filename):
            return jsonify({"error": "Only .wav files are supported",}), 415

        try:
            top_n = int(request.form['top_n'])
        except:
            top_n = 4
        try:
            score_matrix = handle_sed_listen(file, yamnet_m, yamnet_c, top_n)
            return jsonify(score_matrix)
        
        except:
            return jsonify({"error": "Sent audio couldn't be processed",}), 500

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
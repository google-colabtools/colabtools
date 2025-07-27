from flask import Flask, render_template_string, send_from_directory, abort, url_for, request, redirect, send_file
import os
from werkzeug.utils import secure_filename
import time
import zipfile
import tempfile
import shutil

app = Flask(__name__)

# Adicione isso no início do seu arquivo, após criar o app Flask
@app.after_request
def allow_iframe(response):
    response.headers.pop('X-Frame-Options', None)
    return response

# Define o diretório base para o explorador de arquivos
BASE_DIR = os.getcwd()

START_TIME = time.time()

@app.route('/')
def home():
    uptime_seconds = int(time.time() - START_TIME)
    return f'''
    <html>
        <head>
            <title>App is Running</title>
            <style>
                body {{
                    background: #23272e;
                    color: #c7d0dc;
                    font-family: 'Segoe UI', 'Arial', sans-serif;
                    margin: 0;
                    padding: 0;
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }}
                .container {{
                    background: #2c313c;
                    padding: 40px 60px;
                    border-radius: 12px;
                    box-shadow: 0 4px 24px rgba(0,0,0,0.4);
                    text-align: center;
                }}
                h1 {{
                    color: #7ecfff;
                    margin-bottom: 12px;
                }}
                p {{
                    color: #c7d0dc;
                    font-size: 1.2em;
                }}
                .button {{
                    display: inline-block;
                    margin-top: 25px;
                    padding: 12px 24px;
                    background-color: #7ecfff;
                    color: #23272e;
                    text-decoration: none;
                    font-weight: 600;
                    border-radius: 8px;
                    transition: background-color 0.3s, transform 0.2s;
                }}
                .button:hover {{
                    background-color: #a2e0ff;
                    transform: translateY(-2px);
                }}
            </style>
            <script>
                let uptime = {uptime_seconds};
                function formatUptime(s) {{
                    let h = Math.floor(s/3600);
                    let m = Math.floor((s%3600)/60);
                    let sec = s%60;
                    return h.toString().padStart(2,'0')+':'+m.toString().padStart(2,'0')+':'+sec.toString().padStart(2,'0');
                }}
                function updateUptime() {{
                    uptime += 1;
                    document.getElementById('uptime').innerText = formatUptime(uptime);
                }}
                setInterval(updateUptime, 1000);
                window.onload = function() {{
                    document.getElementById('uptime').innerText = formatUptime(uptime);
                }};
            </script>
        </head>
        <body>
            <div class="container">
                <h1>App is Running...</h1>
                <p>Seu serviço Flask está ativo e pronto!</p>
                <p><b>Uptime:</b> <span id="uptime"></span></p>
                <a href="/files" class="button">Explorar Arquivos</a>
            </div>
        </body>
    </html>
    '''

# Template HTML para o explorador de arquivos
FILE_EXPLORER_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <title>File Explorer</title>
    <style>
        body { background: #23272e; color: #c7d0dc; font-family: 'Segoe UI', 'Arial', sans-serif; margin: 20px; }
        .container { background: #2c313c; padding: 20px 40px; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.4); max-width: 900px; margin: auto; }
        h1, h2 { color: #7ecfff; border-bottom: 1px solid #4f5b6a; padding-bottom: 10px; }
        ul { list-style-type: none; padding: 0; }
        li { padding: 8px 12px; border-bottom: 1px solid #3a424d; display: flex; justify-content: space-between; align-items: center; }
        li:last-child { border-bottom: none; }
        a { color: #7ecfff; text-decoration: none; font-weight: 500; }
        a:hover { text-decoration: underline; }
        .dir::before { content: '📁'; margin-right: 10px; }
        .file::before { content: '📄'; margin-right: 10px; }
        .breadcrumbs { margin-bottom: 20px; padding: 10px; background-color: #23272e; border-radius: 5px; }
        .breadcrumbs a { color: #c7d0dc; }
        .breadcrumbs span { color: #777; margin: 0 5px; }
        form { margin-top: 20px; padding: 15px; background-color: #3a424d; border-radius: 8px; }
        input[type="file"] { color: #c7d0dc; }
        input[type="submit"] {
            background-color: #7ecfff; color: #23272e; border: none;
            padding: 8px 16px; border-radius: 5px; font-weight: 600; cursor: pointer;
            transition: background-color 0.3s;
        }
        input[type="submit"]:hover { background-color: #a2e0ff; }
        .item-actions { display: flex; gap: 10px; align-items: center; }
        .download-btn {
            background-color: #28a745; color: white; border: none;
            padding: 4px 8px; border-radius: 4px; font-size: 12px;
            cursor: pointer; text-decoration: none;
            transition: background-color 0.3s;
        }
        .download-btn:hover { background-color: #218838; }
    </style>
</head>
<body>
    <div class="container">
        <h1>File Explorer</h1>
        <div class="breadcrumbs">
            {% for crumb in breadcrumbs %}
                <a href="{{ crumb.path }}">{{ crumb.name }}</a>
                {% if not loop.last %}<span>/</span>{% endif %}
            {% endfor %}
        </div>

        <h2>Upload de Arquivo</h2>
        <form method="post" enctype="multipart/form-data">
            <input type="file" name="file" required>
            <input type="submit" value="Upload">
        </form>

        <h2>Diretórios</h2>
        <ul>
            {% for dir in dirs %}
            <li>
                <a class="dir" href="{{ url_for('file_explorer', subpath=(current_path + '/' if current_path else '') + dir) }}">{{ dir }}</a>
                <div class="item-actions">
                    <a href="{{ url_for('download_folder', subpath=(current_path + '/' if current_path else '') + dir) }}" class="download-btn">📥 ZIP</a>
                </div>
            </li>
            {% else %}
            <li>Nenhum diretório encontrado.</li>
            {% endfor %}
        </ul>

        <h2>Arquivos</h2>
        <ul>
            {% for file in files %}
            <li>
                <a class="file" href="{{ url_for('file_explorer', subpath=(current_path + '/' if current_path else '') + file) }}">{{ file }}</a>
                <div class="item-actions">
                    <a href="{{ url_for('file_explorer', subpath=(current_path + '/' if current_path else '') + file) }}" class="download-btn">📥 Download</a>
                </div>
            </li>
            {% else %}
            <li>Nenhum arquivo encontrado.</li>
            {% endfor %}
        </ul>
    </div>
</body>
</html>
"""

@app.route('/download_folder/<path:subpath>')
def download_folder(subpath):
    safe_base_dir = os.path.abspath(BASE_DIR)
    folder_path = os.path.abspath(os.path.join(safe_base_dir, subpath))
    
    if not folder_path.startswith(safe_base_dir) or not os.path.exists(folder_path) or not os.path.isdir(folder_path):
        abort(404)
    
    # Cria um arquivo temporário ZIP
    temp_dir = tempfile.mkdtemp()
    folder_name = os.path.basename(folder_path)
    zip_filename = f"{folder_name}.zip"
    zip_path = os.path.join(temp_dir, zip_filename)
    
    try:
        # Cria o arquivo ZIP
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(folder_path):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, folder_path)
                    zipf.write(file_path, arcname)
        
        # Envia o arquivo ZIP
        return send_file(zip_path, as_attachment=True, download_name=zip_filename, mimetype='application/zip')
    
    except Exception as e:
        # Limpa o diretório temporário em caso de erro
        shutil.rmtree(temp_dir, ignore_errors=True)
        abort(500)

@app.route('/files/', methods=['GET', 'POST'])
@app.route('/files/<path:subpath>', methods=['GET', 'POST'])
def file_explorer(subpath=''):
    safe_base_dir = os.path.abspath(BASE_DIR)
    requested_path = os.path.abspath(os.path.join(safe_base_dir, subpath))

    if not requested_path.startswith(safe_base_dir) or not os.path.exists(requested_path):
        abort(404)

    if os.path.isdir(requested_path):
        if request.method == 'POST':
            if 'file' not in request.files:
                return redirect(request.url)
            file = request.files['file']
            if file.filename == '':
                return redirect(request.url)
            if file:
                filename = secure_filename(file.filename)
                file.save(os.path.join(requested_path, filename))
                return redirect(url_for('file_explorer', subpath=subpath))

        items = sorted(os.listdir(requested_path), key=str.lower)
        dirs = [item for item in items if os.path.isdir(os.path.join(requested_path, item))]
        files = [item for item in items if os.path.isfile(os.path.join(requested_path, item))]

        path_parts = subpath.split('/') if subpath else []
        breadcrumbs = [{'name': 'home', 'path': url_for('file_explorer')}]
        for i, part in enumerate(path_parts):
            if part:
                breadcrumbs.append({'name': part, 'path': url_for('file_explorer', subpath='/'.join(path_parts[:i+1]))})

        return render_template_string(FILE_EXPLORER_TEMPLATE, dirs=dirs, files=files, current_path=subpath, breadcrumbs=breadcrumbs)
    else:
        directory = os.path.dirname(requested_path)
        filename = os.path.basename(requested_path)
        # Lista de extensões que devem ser forçadamente baixadas (consideradas "binárias")
        binary_extensions = [
            '.zip', '.rar', '.7z', '.tar', '.gz',  # Arquivos compactados
            '.exe', '.msi', '.dmg', '.deb',        # Executáveis e instaladores
            '.bin', '.iso', '.img', '.dll', '.so', # Imagens de disco e binários
            '.doc', '.docx', '.xls', '.xlsx',     # Documentos do Office que não são bem visualizados
            '.ppt', '.pptx',
            '.mp3', '.wav', '.mp4', '.avi', '.mkv' # Arquivos de mídia que são melhores para baixar
        ]

        # Força o download se a extensão estiver na lista de binários
        force_download = any(filename.lower().endswith(ext) for ext in binary_extensions)

        return send_from_directory(directory, filename, as_attachment=force_download)

if __name__ == "__main__":
    app.run()
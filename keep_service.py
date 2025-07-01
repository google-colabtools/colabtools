from flask import Flask

app = Flask(__name__)

@app.route('/')
def home():
    return '''
    <html>
        <head>
            <style>
                body {
                    background: #23272e;
                    color: #c7d0dc;
                    font-family: 'Segoe UI', 'Arial', sans-serif;
                    margin: 0;
                    padding: 0;
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .container {
                    background: #2c313c;
                    padding: 40px 60px;
                    border-radius: 12px;
                    box-shadow: 0 4px 24px rgba(0,0,0,0.4);
                    text-align: center;
                }
                h1 {
                    color: #7ecfff;
                    margin-bottom: 12px;
                }
                p {
                    color: #c7d0dc;
                    font-size: 1.2em;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>App is Running...</h1>
                <p>Seu serviço Flask está ativo e pronto!</p>
            </div>
        </body>
    </html>
    '''

if __name__ == "__main__":
    app.run()
from flask import Flask, jsonify, render_template_string
import platform
import time

app = Flask(__name__)

def get_ram_usage_linux():
    """Calcula o uso de RAM em % no Linux lendo /proc/meminfo."""
    try:
        with open('/proc/meminfo', 'r') as mem:
            meminfo = {}
            for line in mem:
                parts = line.split(':')
                if len(parts) == 2:
                    key = parts[0].strip()
                    # Pega o valor numérico, ignorando unidades como 'kB'
                    value = int(parts[1].strip().split()[0])
                    meminfo[key] = value
        
        # Usar MemAvailable é mais preciso para "memória livre real"
        mem_total = meminfo.get('MemTotal')
        mem_available = meminfo.get('MemAvailable')
        
        if mem_total and mem_available:
            mem_used = mem_total - mem_available
            return round((mem_used / mem_total) * 100.0, 2)

    except (FileNotFoundError, ValueError, KeyError, ZeroDivisionError):
        return "N/A"
    return "N/A"

def get_cpu_times_linux():
    """Lê os tempos de CPU do /proc/stat."""
    with open('/proc/stat') as f:
        # A primeira linha é para a CPU agregada
        line = f.readline()
        # cpu user nice system idle iowait irq softirq steal ...
        fields = [float(column) for column in line.strip().split()[1:]]
    return fields

def calculate_cpu_usage_linux(interval=1):
    """Calcula o uso da CPU em um intervalo de tempo no Linux."""
    try:
        start_times = get_cpu_times_linux()
        time.sleep(interval)
        end_times = get_cpu_times_linux()

        # Calcula as diferenças de tempo total e ocioso
        delta_times = [e - s for s, e in zip(start_times, end_times)]
        
        total_time = sum(delta_times)
        # O tempo ocioso é o 4º valor (índice 3)
        idle_time = delta_times[3]

        if total_time == 0:
            return 0.0

        usage = (1.0 - idle_time / total_time) * 100.0
        return round(usage, 2)
    except (FileNotFoundError, IndexError, ValueError, ZeroDivisionError):
        return "N/A"

@app.route('/')
def home():
    # O HTML agora é uma string de template para facilitar a leitura
    # e inclui JavaScript para atualização dinâmica.
    html_template = """
    <html>
        <head>
            <title>System Monitor</title>
            <style>
                body {
                    background: #23272e;
                    color: #c7d0dc;
                    font-family: 'Segoe UI', 'Roboto', 'Arial', sans-serif;
                    margin: 0;
                    padding: 0;
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: background-color 0.5s ease;
                }
                .container {
                    background: #2c313c;
                    padding: 40px 60px;
                    border-radius: 12px;
                    box-shadow: 0 4px 24px rgba(0,0,0,0.4);
                    text-align: left;
                    width: 400px;
                }
                h1 {
                    color: #7ecfff;
                    margin-bottom: 24px;
                    text-align: center;
                }
                .stat {
                    color: #c7d0dc;
                    font-size: 1.2em;
                    margin-bottom: 15px;
                    display: flex;
                    justify-content: space-between;
                }
                .stat-label {
                    font-weight: bold;
                }
                .stat-value {
                    font-family: 'Courier New', Courier, monospace;
                    background-color: #23272e;
                    padding: 2px 8px;
                    border-radius: 4px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>System Monitor</h1>
                <div class="stat">
                    <span class="stat-label">CPU Usage:</span>
                    <span id="cpu-usage" class="stat-value">Loading...</span>
                </div>
                <div class="stat">
                    <span class="stat-label">RAM Usage:</span>
                    <span id="ram-usage" class="stat-value">Loading...</span>
                </div>
            </div>
            <script>
                async function updateStats() {
                    try {
                        const response = await fetch('/data');
                        const data = await response.json();

                        const cpu_text = typeof data.cpu_usage === 'number' ? data.cpu_usage.toFixed(2) + '%' : data.cpu_usage;
                        const ram_text = typeof data.ram_usage === 'number' ? data.ram_usage.toFixed(2) + '%' : data.ram_usage;

                        document.getElementById('cpu-usage').textContent = cpu_text;
                        document.getElementById('ram-usage').textContent = ram_text;
                    } catch (error) {
                        console.error("Failed to fetch system data:", error);
                        document.getElementById('cpu-usage').textContent = "Error";
                        document.getElementById('ram-usage').textContent = "Error";
                    }
                }

                // Atualiza na hora e depois a cada 10 segundos
                updateStats();
                setInterval(updateStats, 10000);
            </script>
        </body>
    </html>
    """
    return render_template_string(html_template)

@app.route('/data')
def data():
    """Fornece os dados do sistema em formato JSON."""
    if platform.system() == "Linux":
        cpu_usage = calculate_cpu_usage_linux(interval=1)
        ram_usage = get_ram_usage_linux()
        return jsonify(cpu_usage=cpu_usage, ram_usage=ram_usage)
    else:
        os_name = platform.system()
        return jsonify(
            cpu_usage=f"N/A on {os_name}", 
            ram_usage=f"N/A on {os_name}"
        )

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5000)
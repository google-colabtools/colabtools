import os
import subprocess
import importlib.util
import sys
import time
from dotenv import load_dotenv

# Carrega o arquivo .env
load_dotenv("config.env")

# Garante que valores sejam strings e limpos
install_bot_env = str(os.getenv("INSTALL_BOT", "EASY_INSTALL")).strip()
config_mode_env = str(os.getenv("CONFIG_MODE", "DEFAULT_CONFIG")).strip()
us_only_env = os.getenv("US_ONLY", "False").strip().lower() == "true"
bot_directory_env = str(os.getenv("BOT_DIRECTORY", "")).strip()
bot_account_env = str(os.getenv("BOT_ACCOUNT", "")).strip()

bot_a_env = os.getenv("BOT_A", "False").strip().lower() == "true"
bot_b_env = os.getenv("BOT_B", "False").strip().lower() == "true"
bot_c_env = os.getenv("BOT_C", "False").strip().lower() == "true"
bot_d_env = os.getenv("BOT_D", "False").strip().lower() == "true"
bot_e_env = os.getenv("BOT_E", "False").strip().lower() == "true"

# URLs de Webhook do Discord carregadas do config.env
# Se não estiverem definidas, serão strings vazias.
discord_webhook_url_log_env = os.getenv("DISCORD_WEBHOOK_URL_LOG", "").strip()
discord_webhook_url_br_env = os.getenv("DISCORD_WEBHOOK_URL_BR", "").strip()
discord_webhook_url_us_env = os.getenv("DISCORD_WEBHOOK_URL_US", "").strip()

# API HuggingFace carregada do config.env
space_repo_id_env = str(os.getenv("SPACE_REPO_ID", "")).strip()
hf_token_env = "hf_" + str(os.getenv("HF_TOKEN", "")).strip()

# Define o basedir como o diretório atual
BASEDIR = os.getcwd()

# Carrega o rwd_functions.py
def load_functions():
    os.makedirs(BASEDIR, exist_ok=True)
    rwd_path = os.path.join(BASEDIR, "rwd_functions.py")
    spec = importlib.util.spec_from_file_location("rwd_functions", rwd_path)
    module = importlib.util.module_from_spec(spec)
    sys.modules["rwd_functions"] = module
    spec.loader.exec_module(module)
    return module

rwd_functions = load_functions()

def run_bots():
    os.chdir(BASEDIR)

    # Usar as variáveis carregadas do .env diretamente
    BOT_DIRECTORY = bot_directory_env
    BOT_ACCOUNT = bot_account_env
    CONFIG_MODE = config_mode_env
    US_ONLY = us_only_env
    INSTALL_BOT = install_bot_env # Se necessário para alguma lógica futura
    DISCORD_WEBHOOK_URL_LOG = discord_webhook_url_log_env
    DISCORD_WEBHOOK_URL_BR = discord_webhook_url_br_env
    DISCORD_WEBHOOK_URL_US = discord_webhook_url_us_env
    SPACE_REPO_ID = space_repo_id_env
    HF_TOKEN = hf_token_env


    rwd_functions.send_discord_log_message(BOT_ACCOUNT, "Iniciando execução...", DISCORD_WEBHOOK_URL_LOG)
    rwd_functions.criar_tarefa(BOT_ACCOUNT)
    # Verifica a localização da VM se US_ONLY estiver ativado
    if US_ONLY:
        print("Verificando localização da VM...")
        try:
            rwd_functions.check_location()
            print("✅ Verificação de localização concluída. VM está nos EUA.")
            rwd_functions.send_discord_log_message(BOT_ACCOUNT, "Verificação de localização: VM está nos EUA.", DISCORD_WEBHOOK_URL_LOG)
        except EnvironmentError as e:
            error_message = f"❌ Erro de localização: {str(e)}. O script será encerrado."
            print(error_message)
            rwd_functions.send_discord_log_message(BOT_ACCOUNT, error_message, DISCORD_WEBHOOK_URL_LOG)
            if SPACE_REPO_ID and HF_TOKEN and HF_TOKEN != "hf_":
                rwd_functions.send_discord_log_message(BOT_ACCOUNT, "Tentando desligar o Space devido ao erro de localização...", DISCORD_WEBHOOK_URL_LOG)
                rwd_functions.stop_space(HF_TOKEN, SPACE_REPO_ID)
            return # Interrompe a execução de run_bots
        except Exception as e:
            error_message = f"❌ Erro inesperado durante check_location: {str(e)}. O script será encerrado."
            print(error_message)
            rwd_functions.send_discord_log_message(BOT_ACCOUNT, error_message, DISCORD_WEBHOOK_URL_LOG)
            if SPACE_REPO_ID and HF_TOKEN and HF_TOKEN != "hf_":
                rwd_functions.send_discord_log_message(BOT_ACCOUNT, "Tentando desligar o Space devido a erro na verificação de localização...", DISCORD_WEBHOOK_URL_LOG)
                rwd_functions.stop_space(HF_TOKEN, SPACE_REPO_ID)
            return # Interrompe a execução de run_bots

    folder_path = os.path.join(BASEDIR, "colabtools_A")
    bot_selections = {
        "A": bot_a_env, "B": bot_b_env, "C": bot_c_env, 
        "D": bot_d_env, "E": bot_e_env
    }
    selected_bots = [bot for bot, selected in bot_selections.items() if selected]

    # Função auxiliar para executar subprocessos e capturar/yield sua saída
    def run_subprocess_and_print_output(command_list, description=""):
        """Executa um comando e transmite sua saída (stdout e stderr) via yield."""
        # Converte a lista de comandos para string para exibição no log
        command_str = ' '.join(command_list)
        if description:
            print(f"{description}...")
        try:
            process = subprocess.Popen(command_list, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1, universal_newlines=True)
            for line in iter(process.stdout.readline, ''):
                if line:
                    print(line.strip())
            process.stdout.close()
            return_code = process.wait()
            if return_code != 0:
                print(f"⚠️ Comando '{command_str}' falhou com código {return_code}")
            elif description:
                print(f"✅ {description} concluído.")
        except Exception as e:
            print(f"❌ Exceção ao executar '{command_str}': {str(e)}")

    # Debug inicial com print
    print(f"[DEBUG run.py] INSTALL_BOT: '{INSTALL_BOT}'")
    print(f"[DEBUG run.py] CONFIG_MODE: '{CONFIG_MODE}'")
    print(f"[DEBUG run.py] US_ONLY: {US_ONLY}")
    print(f"[DEBUG run.py] BOT_DIRECTORY: '{BOT_DIRECTORY}'")
    print(f"[DEBUG run.py] BOT_ACCOUNT: '{BOT_ACCOUNT}'")
    print(f"[DEBUG run.py] DISCORD_WEBHOOK_URL_US: '{DISCORD_WEBHOOK_URL_LOG}'")
    print(f"[DEBUG run.py] DISCORD_WEBHOOK_URL_BR: '{DISCORD_WEBHOOK_URL_BR}'")
    print(f"[DEBUG run.py] DISCORD_WEBHOOK_URL_US: '{DISCORD_WEBHOOK_URL_US}'")
    print(f"[DEBUG run.py] SPACE_REPO_ID: '{SPACE_REPO_ID}'")
    print(f"[DEBUG run.py] HF_TOKEN: '{HF_TOKEN}'")

    if not os.path.exists(folder_path):
        # A verificação US_ONLY foi movida para o início da função.
        print("Instalando bots...")
        source_mv = os.path.join(BASEDIR, 'colabtools')
        dest_mv = os.path.join(BASEDIR, 'colabtools_A')

        if os.path.exists(source_mv):
            run_subprocess_and_print_output(command_list=["mv", source_mv, dest_mv], description=f"Movendo {source_mv} para {dest_mv}")
        else:
            print(f"⚠️ '{source_mv}' não encontrado para mover. Verifique se o diretório base 'colabtools' existe.")

        src_copy = os.path.join(BASEDIR, "colabtools_A")
        if os.path.exists(src_copy):
            for suffix in ["B", "C", "D", "E"]:
                dst_copy = os.path.join(BASEDIR, f"colabtools_{suffix}")
                if os.path.exists(dst_copy):
                    run_subprocess_and_print_output(command_list=["rm", "-rf", dst_copy], description=f"Removendo destino existente {dst_copy}")
                run_subprocess_and_print_output(command_list=["cp", "-r", src_copy, dst_copy], description=f"Copiando {src_copy} para {dst_copy}")
            print("✅ Estrutura de diretórios dos bots criada.")
        else:
            print(f"⚠️ '{src_copy}' não encontrado para copiar. A etapa de mover/criar 'colabtools_A' pode ter falhado.")
    else:
        print("📁 Diretório já existe. Pulando instalação.")

    os.chdir(BASEDIR)

    print("Configurando ricronus e diretórios...")
    rwd_functions.setup_ricronus_and_directories(BOT_DIRECTORY)
    print("Copiando Rewards Drive...")
    rwd_functions.copy_rewards_drive()

    if selected_bots:
        print(f"Executando tarefas para os bots selecionados: {', '.join(selected_bots)}")
        rwd_functions.execute_tasks_for_selected_bots(BOT_DIRECTORY, BOT_ACCOUNT, CONFIG_MODE, *selected_bots)
        
        print("Iniciando bots...")
        rwd_functions.start_bots(DISCORD_WEBHOOK_URL_BR, DISCORD_WEBHOOK_URL_US, *selected_bots) # Saída principal ainda no console
        print("✅ Bots executados e encerrados.")

        if CONFIG_MODE == "GEN_COOKIE_CONFIG":
            pass
        else:
            print("Concluindo tarefa...")
            rwd_functions.concluir_tarefa(BOT_ACCOUNT)    

        print("Fazendo upload de sessions para o google drive...")
        rwd_functions.upload_rewards_drive()
    else:
        print("⚠️ Nenhum bot foi selecionado.")

    rwd_functions.send_discord_log_message(BOT_ACCOUNT, "Execução finalizada, desligando Space.", DISCORD_WEBHOOK_URL_LOG)
    rwd_functions.stop_space(HF_TOKEN, SPACE_REPO_ID)
    print("🏁 Processo concluído.")
    time.sleep(60)

if __name__ == '__main__':
    run_bots()

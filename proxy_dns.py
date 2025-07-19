# custom_dns_plugin.py
from proxy.http.proxy import HttpProxyPlugin
import dns.resolver

class CustomDNSResolver:
    def __init__(self, nameserver='8.8.8.8'):
        self.resolver = dns.resolver.Resolver()
        self.resolver.nameservers = [nameserver]

    def resolve(self, hostname):
        try:
            answer = self.resolver.resolve(hostname, 'A')
            ip = answer[0].to_text()
            print(f"[DNS 8.8.8.8] {hostname} -> {ip}")
            return ip
        except Exception as e:
            import socket
            try:
                ip = socket.gethostbyname(hostname)
                print(f"[Fallback system DNS] {hostname} -> {ip}")
                return ip
            except Exception:
                raise e

class CustomHttpProxyPlugin(HttpProxyPlugin):
    def resolve_host(self, host, port):
        resolver = CustomDNSResolver()
        ip = resolver.resolve(host)
        return (ip, port)

PLUGIN = CustomHttpProxyPlugin
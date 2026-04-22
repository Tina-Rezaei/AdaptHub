import socket
import json
import  sys
from core import optimization_executor
import time


def main():
    server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server_socket.bind(('127.0.0.1', 65432))
    server_socket.listen(1)
    print('Python server listening on port 65432')

    while True:
        try:
            conn, addr = server_socket.accept()
            print('Connected by', addr)
            data = conn.recv(4)
            print(1)
            body_len = int.from_bytes(data, 'little')
            print(2)
            body = conn.recv(body_len)
            print(3)
            if not body:
                break

            # Decode JSON data
            params = json.loads(body.decode('utf-8'))
            print(4)
            # print('ReceivedData:', params)

            # Process data
            response = optimization_executor(params)
            print('Func done')

            # Send back response
            conn.sendall(json.dumps(response).encode('utf-8'))
            conn.close()
        except Exception as e:
            print(e)

main()
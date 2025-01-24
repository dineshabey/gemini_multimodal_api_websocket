import asyncio
import json
import ssl
import websockets
from websockets.legacy.protocol import WebSocketCommonProtocol
from websockets.legacy.server import WebSocketServerProtocol

# Configuration for the remote Gemini service
HOST = "us-central1-aiplatform.googleapis.com"
SERVICE_URL = f"wss://{HOST}/ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent"

DEBUG = True  # Set to True for verbose logging

# Load SSL certificate and private key
ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
ssl_context.load_cert_chain(certfile="server.crt", keyfile="server.key")


async def proxy_task(
    client_websocket: WebSocketCommonProtocol, server_websocket: WebSocketCommonProtocol
) -> None:
    """
    Forwards messages from one WebSocket connection to another.

    Args:
        client_websocket: The WebSocket connection from which to receive messages.
        server_websocket: The WebSocket connection to which to send messages.
    """
    try:
        async for message in client_websocket:
            try:
                data = json.loads(message)
                if DEBUG:
                    print("Proxying message:", data)
                await server_websocket.send(json.dumps(data))
            except json.JSONDecodeError:
                print(f"Error: Invalid JSON format in message: {message}")
                await client_websocket.close(code=1008, reason="Invalid JSON format")
                return
            except Exception as e:
                print(f"Error processing message from client: {e}")
    except websockets.ConnectionClosed:
        print("Client connection closed.")
    finally:
        await server_websocket.close()


async def create_proxy(
    client_websocket: WebSocketCommonProtocol, bearer_token: str
) -> None:
    """
    Establishes a WebSocket connection to the server and creates two tasks for
    bidirectional message forwarding between the client and the server.

    Args:
        client_websocket: The WebSocket connection of the client.
        bearer_token: The bearer token for authentication with the server.
    """
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {bearer_token}",
    }

    try:
        async with websockets.connect(
            SERVICE_URL, extra_headers=headers
        ) as server_websocket:
            print("Connected to Gemini API WebSocket.")
            client_to_server_task = asyncio.create_task(
                proxy_task(client_websocket, server_websocket)
            )
            server_to_client_task = asyncio.create_task(
                proxy_task(server_websocket, client_websocket)
            )
            await asyncio.gather(client_to_server_task, server_to_client_task)
    except websockets.ConnectionClosedError as e:
        print(f"Server connection closed unexpectedly: {e}")
        await client_websocket.close(code=1011, reason="Server connection closed")
    except Exception as e:
        print(f"Failed to establish server connection: {e}")
        await client_websocket.close(code=1011, reason="Failed to connect to server")


async def handle_client(client_websocket: WebSocketServerProtocol) -> None:
    """
    Handles a new client connection, expecting the first message to contain a bearer token.
    Establishes a proxy connection to the server upon successful authentication.

    Args:
        client_websocket: The WebSocket connection of the client.
    """
    print("New connection established...")
    try:
        # Wait for the first message from the client
        auth_message = await asyncio.wait_for(client_websocket.recv(), timeout=30.0)
        try:
            auth_data = json.loads(auth_message)
        except json.JSONDecodeError:
            print(f"Error: Invalid JSON format in message: {auth_message}")
            await client_websocket.close(code=1008, reason="Invalid authentication message")
            return

        if "bearer_token" in auth_data:
            bearer_token = auth_data["bearer_token"]
            print(f"Received bearer token: {bearer_token}")
        else:
            print("Error: Bearer token not found in the first message.")
            await client_websocket.close(code=1008, reason="Bearer token missing")
            return

        # Create proxy between the client and the remote server
        await create_proxy(client_websocket, bearer_token)

    except asyncio.TimeoutError:
        print("TimeoutError: No authentication message received within the timeout period.")
        await client_websocket.close(code=1008, reason="Authentication timeout")
    except websockets.ConnectionClosed as e:
        print(f"Client connection closed: {e}")
    except Exception as e:
        print(f"Unexpected error: {e}")
        await client_websocket.close(code=1011, reason="Unexpected server error")


async def main() -> None:
    """
    Starts the WebSocket server and listens for incoming client connections.
    """
    print("Starting WebSocket proxy server on wss://0.0.0.0:8080...")
    async with websockets.serve(handle_client, "0.0.0.0", 8080, ssl=ssl_context):
        print("WebSocket proxy server running on wss://0.0.0.0:8080...")
        # Keep the server running forever
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())

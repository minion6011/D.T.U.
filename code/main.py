import json, os
from fastapi import FastAPI, status, UploadFile
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse
from concurrent.futures import ThreadPoolExecutor
import shutil

app = FastAPI(title="DTU", version="1.0.0")
app.mount("/website", StaticFiles(directory="website"), name="website")


# - Load data.json
with open('data.json') as f:
	data = json.load(f)


@app.post("/login", summary="Get the requests key", responses={
	422: {}, # - Remove default docs
	406: {},
	200: {
		"content": {
			"application/json": {
				"example": {"key": "string"}
			},
		},
		"description": "Return the admin key"
		}})
async def login(key: str):
	if key == data["key"] and data["attempts"] < 3:
		return JSONResponse(status_code=status.HTTP_200_OK, content={"key": data["hash_key"]})
	elif data["attempts"] < 3:
		data["attempts"] += 1
		with open('data.json', 'w') as f:
			json.dump(data, f)
			f.close()
	return JSONResponse(status_code=status.HTTP_406_NOT_ACCEPTABLE, content={"message": f"Attemps left: {str(3 - data["attempts"])}"})



@app.post("/reset_attempts", summary="Reset the login attempts", responses={422: {}, 401: {}, 200: {}})
async def reset_attempts(key: str):
	if key == data["hash_key"]:
		data["attempts"] = 0
		with open('data.json', 'w') as f:
			json.dump(data, f)
			f.close()
		return JSONResponse(status_code=status.HTTP_200_OK, content={"message": "Attempts reseted successfully"})
	return JSONResponse(status_code=status.HTTP_401_UNAUTHORIZED, content={"message": "Unauthorized"})



def search_in_data_path(data_path: str, query: str):  # - Founded Online and Edited
	results = []

	BINARY_EXTENSIONS = {
		".mp4", ".avi", ".mov", ".mkv",  # video
		".mp3", ".wav", ".flac",         # audio
		".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp",  # immagini
		".zip", ".rar", ".7z", ".tar", ".gz",  # archivi
		".exe", ".dll", ".bin", ".iso", ".img",  # binari
		".pdf", ".doc", ".docx", ".ppt", ".pptx"  # documenti binari
	}

	def is_readable_file(filename: str) -> bool:
		_, ext = os.path.splitext(filename)
		return ext.lower() not in BINARY_EXTENSIONS

	query_lower = query.lower()

	def search_in_file(file_entry, folder_name, query_lower):
		if not is_readable_file(file_entry.name):
			return None
		try:
			with open(file_entry.path, "r", encoding="utf-8", errors="ignore") as f:
				for line in f:
					if query_lower in line.lower():
						return f"Result in Data Folder file content: {folder_name}/{file_entry.name}"
		except (IsADirectoryError, PermissionError, UnicodeDecodeError):
			return None

	futures = []
	with ThreadPoolExecutor() as executor:
		for entry in os.scandir(data_path):
			if not entry.is_dir():
				continue
			if query_lower in entry.name.lower():
				results.append(f"Result in Data Folder: {entry.name}")

			for file_entry in os.scandir(entry.path):
				if query_lower in file_entry.name.lower():
					results.append(f"Result in Data Folder file name: {entry.name}/{file_entry.name}")
				futures.append(executor.submit(search_in_file, file_entry, entry.name, query_lower))

		for future in futures:
			result = future.result()
			if result:
				results.append(result)
	return results

@app.post("/search", summary="Search for something in the data folders", responses={
	422: {}, # - Remove default docs
	401: {},
	200: {
		"content": {
			"application/json": {
				"example": {"results": ["data1", "data2"]}
			},
		},
		"description": "Return results of the search"
		}})
async def search(key:str, query: str):
	if key == data["hash_key"]:
		results = search_in_data_path(data["data_path"], query)
		
		return JSONResponse(status_code=status.HTTP_200_OK, content={"results": results})
	return JSONResponse(status_code=status.HTTP_401_UNAUTHORIZED, content={"message": "Unauthorized"})



@app.post("/data_create", summary="Create a Data Folder", tags=["Data Commands"], responses={422: {}, 401: {}, 409: {}, 200: {}})
async def data_create(key:str, name: str):
	if key == data["hash_key"]:
		if not os.path.exists(os.path.join(data["data_path"], name)):
			os.makedirs(os.path.join(data["data_path"], name))
			return JSONResponse(status_code=status.HTTP_200_OK, content={"message": "Data Folder created successfully"})
		else:
			return JSONResponse(status_code=status.HTTP_409_CONFLICT, content={"message": "Data Folder already exists"})
	return JSONResponse(status_code=status.HTTP_401_UNAUTHORIZED, content={"message": "Unauthorized"})

@app.post("/data_edit", summary="Edit a Data Folder", tags=["Data Commands"], responses={422: {}, 401: {}, 404: {}, 409: {}, 200: {}})
async def data_edit(key:str, old_name: str, new_name: str):
	if key == data["hash_key"]:
		if not os.path.exists(os.path.join(data["data_path"], new_name)):
			if os.path.exists(os.path.join(data["data_path"], old_name)):
				os.rename(os.path.join(data["data_path"], old_name), os.path.join(data["data_path"], new_name))
				return JSONResponse(status_code=status.HTTP_200_OK, content={"message": "Data Folder renamed successfully"})
			else:
				return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"message": "Data Folder with this name doesn't exists"})
		else:
			return JSONResponse(status_code=status.HTTP_409_CONFLICT, content={"message": "Data Folder with the new name already exists"})
	return JSONResponse(status_code=status.HTTP_401_UNAUTHORIZED, content={"message": "Unauthorized"})

@app.post("/data_remove", summary="Remove a Data Folder", responses={422: {}, 401: {}, 404: {}, 200: {}}, tags=["Data Commands"])
async def data_remove(key:str, name: str):
	if key == data["hash_key"]:
		if os.path.exists(os.path.join(data["data_path"], name)):
			shutil.rmtree(os.path.join(data["data_path"], name), ignore_errors=True)
			return JSONResponse(status_code=status.HTTP_200_OK, content={"message": "Data Folder removed successfully"})
		else:
			return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"message": "Data Folder with this name doesn't exists"})
	return JSONResponse(status_code=status.HTTP_401_UNAUTHORIZED, content={"message": "Unauthorized"})

@app.post("/data_list", summary="List all Data Folders", tags=["Data Commands"], responses={
	422: {}, # - Remove default docs
	401: {},
	200: {
		"content": {
			"application/json": {
				"example": {"message": "Data Folders: <folder1>, <folder2>, <folder3>"}
			},
		},
		"description": "List all Data Folders"
		}})
async def data_list(key:str):
	if key == data["hash_key"]:
		return JSONResponse(status_code=status.HTTP_200_OK, content={"message": os.listdir(data["data_path"])})
	return JSONResponse(status_code=status.HTTP_401_UNAUTHORIZED, content={"message": "Unauthorized"})


@app.post("/file_list", summary="List all the files from a Data Folder", tags=["File Commands"], responses={
	422: {}, # - Remove default docs
	401: {},
	404: {},
	200: {
		"content": {
			"application/json": {
				"example": {"message": "Files: <file1>, <file2>, <file3>"}
			},
		},
		"description": "List all the files from a Data Folde"
		}})
async def file_list(key:str, name: str):
	if key == data["hash_key"]:
			if os.path.exists(os.path.join(data["data_path"], name)):
				return JSONResponse(status_code=status.HTTP_200_OK, content={"message": os.listdir(os.path.join(data["data_path"], name))})
			else:
				return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"message": "Data Folder with this name doesn't exists"})
	return JSONResponse(status_code=status.HTTP_401_UNAUTHORIZED, content={"message": "Unauthorized"})

@app.post("/file_add", summary="Add a file to a Data Folder", tags=["File Commands"], responses={
	422: {}, # - Remove default docs
	401: {},
	404: {},
	200: {
		"content": {
			"application/json": {
				"example": {"message": "<file1> added, <file2> already existing, <file3> added"}
			},
		},
		"description": "Add files to a Data Folder"
		}})
async def file_add(key:str, name: str, files: list[UploadFile]):
	if key == data["hash_key"]:
		msg = ""
		if os.path.exists(os.path.join(data["data_path"], name)):
			file_existing = os.listdir(os.path.join(data["data_path"], name))
			for file in files:
				if not file.filename in file_existing:
					file_location = os.path.join(data["data_path"], name, file.filename)
					with open(file_location, "wb+") as file_object:
						file_object.write(file.file.read())
						msg += file.filename + " added, "
				else:
					msg += file.filename + " alredy existing, "
			return JSONResponse(status_code=status.HTTP_200_OK, content={"message": msg[:-2]})
		else:
			return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"message": "Data Folder with this name doesn't exists"})
	return JSONResponse(status_code=status.HTTP_401_UNAUTHORIZED, content={"message": "Unauthorized"})

@app.post("/file_remove", summary="Remove a file from a Data Folders", tags=["File Commands"], responses={422: {}, 401: {}, 406: {}, 404: {}, 200: {}})
async def file_remove(key:str, name: str, file_name: str):
	if key == data["hash_key"]:
		if os.path.exists(os.path.join(data["data_path"], name)):
			file_existing = os.listdir(os.path.join(data["data_path"], name))
			if file_name in file_existing:
				os.remove(os.path.join(data["data_path"], name, file_name))
				return JSONResponse(status_code=status.HTTP_200_OK, content={"message": "File Removed successfully"})
			else:
				return JSONResponse(status_code=status.HTTP_406_NOT_ACCEPTABLE, content={"message": "No file found with this name in the Data Folder"})
		else:
			return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"message": "Data Folder with this name doesn't exists"})
	return JSONResponse(status_code=status.HTTP_401_UNAUTHORIZED, content={"message": "Unauthorized"})

@app.post("/file_rename", summary="Rename a file from a Data Folders", tags=["File Commands"], responses={422: {}, 401: {}, 404: {}, 406: {}, 409: {}, 200: {}})
async def file_rename(key:str, name: str, old_file_name: str, new_file_name: str):
	if key == data["hash_key"]:
		if os.path.exists(os.path.join(data["data_path"], name)):
			file_existing = os.listdir(os.path.join(data["data_path"], name))
			if old_file_name in file_existing:
				if not new_file_name in file_existing:
					os.rename(os.path.join(data["data_path"], name, old_file_name), os.path.join(data["data_path"], name, new_file_name))
					return JSONResponse(status_code=status.HTTP_200_OK, content={"message": "File Renamed successfully"})
				else:
					return JSONResponse(status_code=status.HTTP_409_CONFLICT, content={"message": "A file with the new name already exists in the Data Folder"})
			else:
				return JSONResponse(status_code=status.HTTP_406_NOT_ACCEPTABLE, content={"message": "No file found with this name in the Data Folder"})
		else:
			return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"message": "Data Folder with this name doesn't exists"})
	return JSONResponse(status_code=status.HTTP_401_UNAUTHORIZED, content={"message": "Unauthorized"})

@app.post("/file_download", summary="Return a file from the Data Folder", tags=["File Commands"], responses={422: {}, 401: {}, 404: {}, 200: {}})
async def file_download(key:str, name: str, file_name: str):
	if key == data["hash_key"]:
		if os.path.exists(os.path.join(data["data_path"], name, file_name)):
			return FileResponse(status_code=status.HTTP_200_OK, path=os.path.join(data["data_path"], name, file_name))
		else:
			return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"message": "No file or Data Folder found with this name"})
	return JSONResponse(status_code=status.HTTP_401_UNAUTHORIZED, content={"message": "Unauthorized"})

def conv_chr(input_string): # - From Homelab v1
	import html
	input_string = html.unescape(input_string)
	input_string = input_string.replace("\\", "\\")
	input_string = input_string.replace("\n", "\\n").replace("\r", "\\r").replace("\t", "\\t")
	input_string = input_string.replace('"', '\"').replace("'", "\'")
	return input_string

@app.post("/file_get", summary="Get content of a file from the Data Folder", tags=["File Commands"], responses={422: {}, 401: {}, 404: {}, 200: {}})
async def file_get(key:str, name: str, file_name: str):
	if key == data["hash_key"]:
		if os.path.exists(os.path.join(data["data_path"], name, file_name)):
			with open(os.path.join(data["data_path"], name, file_name), "r", encoding="utf-8") as f:
				r = f.read()
			return JSONResponse(status_code=status.HTTP_200_OK, content={"content": r})
		return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"message": "No file or Data Folder found with this name"})
	return JSONResponse(status_code=status.HTTP_401_UNAUTHORIZED, content={"message": "Unauthorized"})


@app.post("/file_edit", summary="Edit a file from the Data Folder", tags=["File Commands"], responses={422: {}, 401: {}, 404: {}, 200: {}})
async def file_edit(key:str, name: str, file_name: str, content: str):
	if key == data["hash_key"]:
		if os.path.exists(os.path.join(data["data_path"], name, file_name)):
			with open(os.path.join(data["data_path"], name, file_name), "w") as file_object:
				file_object.write(content)
			return JSONResponse(status_code=status.HTTP_200_OK, content={"message": "File edited"})
		return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"message": "No file or Data Folder found with this name"})
	return JSONResponse(status_code=status.HTTP_401_UNAUTHORIZED, content={"message": "Unauthorized"})

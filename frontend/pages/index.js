// index.js

// deps and funcs
import { useState } from "react";

// components
import Head from "next/head";
import DashboardLayout from "../layouts/dashboard";

export default function Index() {
	const [images, setImages] = useState({});
	const [imgGrp, setImgGrp] = useState(0);
	const [labelMap, setLabelMap] = useState(null);

	const [methodName, setMethodName] = useState("grad-cam");
	const [datasetName, setDatasetName] = useState("image_net_1000");
	const [datasetGrpName, setDatasetGrpName] = useState("");
	const [modelName, setModelName] = useState("resnet50");
	const [modelSrvUrl, setModelSrvUrl] = useState("http://127.0.0.1:5002/resnet50");
	const [dbSrvUrl, setDbSrvUrl] = useState("http://127.0.0.1:5000/db/imgnet1000");

	const [taskName, setTaskName] = useState("");
	const [evalTask, setEvalTask] = useState("");
	const [stability, setStability] = useState("");

	const handleSelectImages = async (e) => {
		setImages(e.target.files[0]);
	};

	const uploadPhoto = async (e) => {
		e.preventDefault();

		const file = images[0];
		const img_name_label = await fetch("img_name_label.csv");
		const formData = new FormData();
		const img_group = `t${imgGrp}`;

		formData.append("imgs", file);
		formData.append("img_name_label", img_name_label);
		formData.append("img_group", img_group);

		try {
			const upload = await fetch("http://127.0.0.1:5000/db/imgnet1000/", {
				method: "POST",
				body: formData,
			});
			if (upload.ok) {
				setDatasetGrpName(imgGrp);
				console.log("Uploaded successfully!");
			} else {
				console.error("Upload failed.");
			}
		} catch (err) {
			console.log(err)
		}
	};

	const executeCam = async (e) => {
		e.preventDefault();

		const formData = new FormData();

		formData.append("method_name", methodName)
		formData.append("data_set_name", datasetName)
		formData.append("data_set_group_name", datasetGrpName)
		formData.append("model_name", modelName)
		formData.append("model_service_url", modelSrvUrl)
		formData.append("db_service_url", dbSrvUrl)

		try {
			const execute = await fetch("http://127.0.0.1/xai/pt_cam", {
				method: "POST",
				body: formData
			})

			if (execute.ok) {
				console.log("Executed CAM successfully")
				setTaskName(await fetch("http://127.0.0.1/xai/pt_cam/task?" + new URLSearchParams({
					"task_name": imgGrp
				})))
				getCamExp();
			} else {
				console.log("Execute Failed")
			}
		} catch (err) {
			console.log(err)
		}
	}

	const getCamExp = async (e) => {
		e.preventDefault();

		try {
			const execute = await fetch("http://127.0.0.1/xai/pt_cam?" + new URLSearchParams({
				"task_name": `${taskName}|${modelName}|${methodName}|${datasetName}|${imgGrp}`
			}))

			if (execute.ok) {
				console.log("Get CAM Explanation Successfully.")
			} else {
				console.log("Get CAM failed.")
			}
		} catch (err) {
			console.log(err)
		}
	}

	const startEval = async (e) => {
		e.preventDefault();

		const formData = new FormData();

		formData.append("task_name", `${taskName}|${modelName}|${methodName}|${datasetName}|${imgGrp}`)
		formData.append("xai_service_url", "http://127.0.0.1:5001/xai/pt_cam/")
		formData.append("model_service_url", "http://127.0.0.1:5002/resnet/")
		formData.append("db_service_url", "http://127.0.0.1:5000/db/imgnet1000")

		try {
			const start = await fetch("http://127.0.0.1:5003/evaluation", {
				method: "POST",
				body: formData
			})

			if (start.ok) {
				console.log("Evaluation started successfully")
				setEvalTask(await fetch("http://127.0.0.1:5003/evaluation/task"))
			}
		} catch (err) {
			console.log(err)
		}
	}

	const getStability = async (e) => {
		e.preventDefault();
		try {
			const execute = await fetch("http://127.0.0.1/evaluation/stability?" + new URLSearchParams({
				"task_name": `${taskName}|${modelName}|${methodName}|${datasetName}|${imgGrp}`
			}))

			if (execute.ok) {
				console.log("Get stability successfully.")
			} else {
				console.log("Get stability failed.")
			}
		} catch (err) {
			console.log(err)
		}
	}

	return (
		<DashboardLayout>
			<Head>
				<title></title>
				<link rel="icon" href="sac-logo.png" type="image/x-icon"></link>
			</Head>
			<div className="flex flex-col justify-evenly w-full">
				<div className="flex justify-center">
					<form className="flex flex-wrap justify-start items-center flex-col space-y-4 m-2">
						<label
							className="w-full text-center mb-2 p-2 text-2xl font-medium text-blue-500 bg-slate-200 rounded-md"
							htmlFor="file_input"
						>
							Upload Data
						</label>
						<input
							className="block w-full text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 cursor-pointer focus:outline-none"
							id="file_input"
							type="file"
							accept="image/jpg, image/jpeg"
							multiple
							onChange={handleSelectImages}
						></input>
						<button onClick={uploadPhoto}>Upload Images</button>
						<button onClick={executeCam}>Execute CAM</button>
						<button onClick={getCamExp}>Get CAM Explanation</button>
						<button onClick={getStability}>Get Stability</button>
					</form>
					<div className="flex flex-wrap justify-start items-center flex-col m-2">
						<h3 className="w-full text-center mb-2 p-2 text-2xl font-medium text-blue-500 bg-slate-200 rounded-md">
							Data Summary
						</h3>
						<table>
							<thead>
								<tr>
									<th>#</th>
									<th className="w-64">File</th>
									<th className="w-64">ID</th>
								</tr>
							</thead>
							<tbody>
								{Object?.keys(images).map((keyName, idx) => (
									<tr key={idx}>
										<td>{idx + 1}</td>
										<td className="w-64 truncate">{images[keyName].name}</td>
										<td className="font-mono w-64 truncate">
											{images[keyName].lastModified}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>

				<div className="flex flex-wrap justify-start items-center flex-col m-2">
					<h3 className="w-full text-center mb-2 p-2 text-2xl font-medium text-blue-500 bg-slate-200 rounded-md">
						Results
					</h3>
					<div className="flex justify-center items-center">
						<div id="original" className="flex flex-col items-center justify-center">
							<img
								className="h-72"
								src="dashboard_assets/original_placeholder.png"
							></img>
							<h3>Original Placeholder</h3>
						</div>
						<div id="heatmap" className="flex flex-col items-center justify-center">
							<img
								className="h-72"
								src="dashboard_assets/result_placeholder.png"
							></img>
							<h3>Result Placeholder</h3>
						</div>
					</div>
				</div>
			</div>
		</DashboardLayout>
	);
}

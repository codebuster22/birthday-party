import React, { useEffect, useState } from 'react'
import QRCode from 'react-qr-code'
import Spinner from '../components/Spinner'

import * as LitJsSdk from '@lit-protocol/lit-node-client'
import axios from 'axios'
import { getSignature, utf8ToHex } from '../utils'
import { useAuth } from '@arcana/auth-react'
import { CONTRACT_ADDRESS, getNetwork } from '@/utils/constants'
import { ethers } from 'ethers'

interface Props {
  modalData: any
}

const QRCodeContent = ({ modalData }: Props) => {
  const [QRValue, setQRValue] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingText, setLoadingText] = useState('Generating QR Code')

  const auth = useAuth()

  const onImageDownload = () => {
    const svg = document.getElementById('QRCode')
    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()
    img.onload = () => {
      canvas.width = img.width + 200
      canvas.height = img.height + 200
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(
        img,
        canvas.width / 2 - img.width / 2,
        canvas.height / 2 - img.height / 2,
      )
      const pngFile = canvas.toDataURL('image/png')
      const downloadLink = document.createElement('a')
      downloadLink.download = 'QRCode.png'
      downloadLink.href = `${pngFile}`
      downloadLink.click()
    }
    img.src = `data:image/svg+xml;base64,${Buffer.from(svgData).toString(
      'base64',
    )}`
  }

  const handleDecrypt = async (dataCid) => {
    const litClient = new LitJsSdk.LitNodeClient({
      litNetwork: 'serrano',
    })
    await litClient.connect()
    const dataRes = await axios.get(
      `https://simplr.mypinata.cloud/ipfs/${dataCid}`,
    )
    const data = dataRes.data
    setLoadingText('Verifying your details...')
    const authSig = await getSignature(auth)
    const { data: encryptedString } = await axios({
      url: `https://simplr.mypinata.cloud/ipfs/${data?.secret?.encryptedStringHash}`,
      method: `get`,
      responseType: `blob`,
    })
    const network = getNetwork()
    const encryptionKeyBody = {
      accessControlConditions: data?.secret?.accessControlConditions,
      toDecrypt: data?.secret?.encryptedSymmetricKey,
      chain: network.name,
      authSig,
    }
    const symmetricKey = await litClient.getEncryptionKey(encryptionKeyBody)
    return await LitJsSdk.decryptString(encryptedString, symmetricKey)
  }

  const handleQrGenerate = async (details) => {
    const concatenatedMessage = `${details?.emailid}-${auth.user.address}-${modalData?.tokenId}-${CONTRACT_ADDRESS}`
    const message = utf8ToHex(concatenatedMessage)
    const arcanaProvider = auth.provider
    const provider = new ethers.providers.Web3Provider(arcanaProvider)
    const signer = provider.getSigner()
    const signature = await signer.signMessage(message)
    setLoadingText('Finalizing...')
    const qrCodeData = {
      tokenId: modalData?.tokenId,
      message,
      contractAddress: CONTRACT_ADDRESS,
      signature,
    }
    setQRValue(JSON.stringify(qrCodeData))
    setLoading(false)
  }

  useEffect(() => {
    handleDecrypt(modalData?.dataCid).then((data) => {
      const details = JSON.parse(data)
      setLoadingText('Please approve signature...')
      handleQrGenerate(details)
    })
  }, [])

  if (!loading) {
    return (
      <div className="flex h-full w-screen flex-col items-center bg-white pt-8 ">
        <QRCode value={QRValue} id="QRCode" />
        <button
          className="mt-4 rounded-lg bg-green-500 px-5 py-2.5 text-sm font-medium text-white"
          onClick={() => onImageDownload()}
        >
          Download QR Code
        </button>
      </div>
    )
  } else {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <div className="h-16 w-16">
          <Spinner />
        </div>
        <div className="text-1xl mt-4">{loadingText}</div>
      </div>
    )
  }
}

export default QRCodeContent

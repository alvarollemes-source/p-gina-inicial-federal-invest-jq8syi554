export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          acao: string
          created_at: string
          detalhes: Json | null
          entidade: string
          entidade_id: string | null
          id: string
          is_demo: boolean
          user_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          detalhes?: Json | null
          entidade: string
          entidade_id?: string | null
          id?: string
          is_demo?: boolean
          user_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          detalhes?: Json | null
          entidade?: string
          entidade_id?: string | null
          id?: string
          is_demo?: boolean
          user_id?: string | null
        }
        Relationships: []
      }
      bank_accounts: {
        Row: {
          agencia: string
          agencia_dv: string | null
          ativo: boolean
          banco_codigo: string
          banco_nome: string
          carteira: string | null
          cedente_documento: string | null
          cedente_nome: string | null
          conta: string
          conta_dv: string | null
          convenio: string | null
          created_at: string
          created_by: string | null
          empresa_id: string | null
          id: string
          is_demo: boolean
          tipo_conta: string | null
          updated_at: string
          variacao_carteira: string | null
        }
        Insert: {
          agencia: string
          agencia_dv?: string | null
          ativo?: boolean
          banco_codigo: string
          banco_nome: string
          carteira?: string | null
          cedente_documento?: string | null
          cedente_nome?: string | null
          conta: string
          conta_dv?: string | null
          convenio?: string | null
          created_at?: string
          created_by?: string | null
          empresa_id?: string | null
          id?: string
          is_demo?: boolean
          tipo_conta?: string | null
          updated_at?: string
          variacao_carteira?: string | null
        }
        Update: {
          agencia?: string
          agencia_dv?: string | null
          ativo?: boolean
          banco_codigo?: string
          banco_nome?: string
          carteira?: string | null
          cedente_documento?: string | null
          cedente_nome?: string | null
          conta?: string
          conta_dv?: string | null
          convenio?: string | null
          created_at?: string
          created_by?: string | null
          empresa_id?: string | null
          id?: string
          is_demo?: boolean
          tipo_conta?: string | null
          updated_at?: string
          variacao_carteira?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      boletos: {
        Row: {
          agencia_beneficiario: string | null
          alertas_validacao: Json | null
          arquivo_nome: string | null
          arquivo_tipo: string | null
          arquivo_url: string | null
          banco_codigo: string | null
          banco_nome: string | null
          beneficiario_documento: string | null
          beneficiario_endereco: string | null
          beneficiario_nome: string | null
          beneficiario_tipo_documento: string | null
          campos_baixa_confianca: Json | null
          carteira: string | null
          codigo_barras: string | null
          codigo_barras_original: string | null
          confirmado_pelo_usuario: boolean
          criado_em: string
          criado_por: string | null
          dados_json: Json | null
          dados_pagamento: Json | null
          data_confirmacao: string | null
          data_documento: string | null
          data_envio: string | null
          data_processamento: string | null
          empresa_id: string | null
          erros_validacao: Json | null
          id: string
          instrucoes: Json | null
          linha_digitavel: string | null
          linha_digitavel_original: string | null
          metodo_extracao: string | null
          nivel_confianca: number | null
          nosso_numero: string | null
          numero_documento: string | null
          observacoes_cliente: string | null
          observacoes_internas: string | null
          pagador_cep: string | null
          pagador_cidade: string | null
          pagador_documento: string | null
          pagador_endereco: string | null
          pagador_estado: string | null
          pagador_nome: string | null
          pagador_tipo_documento: string | null
          referencia: string | null
          session_id: string | null
          status: string
          status_validacao: string | null
          texto_extraido: string | null
          tipo_documento: string | null
          tipo_pagamento: string
          updated_at: string
          usuario_confirmacao: string | null
          usuario_envio_id: string | null
          valor_cobrado: number | null
          valor_documento: number | null
          vencimento: string | null
        }
        Insert: {
          agencia_beneficiario?: string | null
          alertas_validacao?: Json | null
          arquivo_nome?: string | null
          arquivo_tipo?: string | null
          arquivo_url?: string | null
          banco_codigo?: string | null
          banco_nome?: string | null
          beneficiario_documento?: string | null
          beneficiario_endereco?: string | null
          beneficiario_nome?: string | null
          beneficiario_tipo_documento?: string | null
          campos_baixa_confianca?: Json | null
          carteira?: string | null
          codigo_barras?: string | null
          codigo_barras_original?: string | null
          confirmado_pelo_usuario?: boolean
          criado_em?: string
          criado_por?: string | null
          dados_json?: Json | null
          dados_pagamento?: Json | null
          data_confirmacao?: string | null
          data_documento?: string | null
          data_envio?: string | null
          data_processamento?: string | null
          empresa_id?: string | null
          erros_validacao?: Json | null
          id?: string
          instrucoes?: Json | null
          linha_digitavel?: string | null
          linha_digitavel_original?: string | null
          metodo_extracao?: string | null
          nivel_confianca?: number | null
          nosso_numero?: string | null
          numero_documento?: string | null
          observacoes_cliente?: string | null
          observacoes_internas?: string | null
          pagador_cep?: string | null
          pagador_cidade?: string | null
          pagador_documento?: string | null
          pagador_endereco?: string | null
          pagador_estado?: string | null
          pagador_nome?: string | null
          pagador_tipo_documento?: string | null
          referencia?: string | null
          session_id?: string | null
          status?: string
          status_validacao?: string | null
          texto_extraido?: string | null
          tipo_documento?: string | null
          tipo_pagamento?: string
          updated_at?: string
          usuario_confirmacao?: string | null
          usuario_envio_id?: string | null
          valor_cobrado?: number | null
          valor_documento?: number | null
          vencimento?: string | null
        }
        Update: {
          agencia_beneficiario?: string | null
          alertas_validacao?: Json | null
          arquivo_nome?: string | null
          arquivo_tipo?: string | null
          arquivo_url?: string | null
          banco_codigo?: string | null
          banco_nome?: string | null
          beneficiario_documento?: string | null
          beneficiario_endereco?: string | null
          beneficiario_nome?: string | null
          beneficiario_tipo_documento?: string | null
          campos_baixa_confianca?: Json | null
          carteira?: string | null
          codigo_barras?: string | null
          codigo_barras_original?: string | null
          confirmado_pelo_usuario?: boolean
          criado_em?: string
          criado_por?: string | null
          dados_json?: Json | null
          dados_pagamento?: Json | null
          data_confirmacao?: string | null
          data_documento?: string | null
          data_envio?: string | null
          data_processamento?: string | null
          empresa_id?: string | null
          erros_validacao?: Json | null
          id?: string
          instrucoes?: Json | null
          linha_digitavel?: string | null
          linha_digitavel_original?: string | null
          metodo_extracao?: string | null
          nivel_confianca?: number | null
          nosso_numero?: string | null
          numero_documento?: string | null
          observacoes_cliente?: string | null
          observacoes_internas?: string | null
          pagador_cep?: string | null
          pagador_cidade?: string | null
          pagador_documento?: string | null
          pagador_endereco?: string | null
          pagador_estado?: string | null
          pagador_nome?: string | null
          pagador_tipo_documento?: string | null
          referencia?: string | null
          session_id?: string | null
          status?: string
          status_validacao?: string | null
          texto_extraido?: string | null
          tipo_documento?: string | null
          tipo_pagamento?: string
          updated_at?: string
          usuario_confirmacao?: string | null
          usuario_envio_id?: string | null
          valor_cobrado?: number | null
          valor_documento?: number | null
          vencimento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "boletos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      cnab_batch_items: {
        Row: {
          batch_id: string
          created_at: string
          id: string
          is_demo: boolean
          ordem: number | null
          payment_document_id: string
          status: string | null
          valor: number | null
        }
        Insert: {
          batch_id: string
          created_at?: string
          id?: string
          is_demo?: boolean
          ordem?: number | null
          payment_document_id: string
          status?: string | null
          valor?: number | null
        }
        Update: {
          batch_id?: string
          created_at?: string
          id?: string
          is_demo?: boolean
          ordem?: number | null
          payment_document_id?: string
          status?: string | null
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cnab_batch_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "cnab_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cnab_batch_items_payment_document_id_fkey"
            columns: ["payment_document_id"]
            isOneToOne: false
            referencedRelation: "payment_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      cnab_batches: {
        Row: {
          ambiente: Database["public"]["Enums"]["cnab_ambiente"]
          bank_account_id: string | null
          created_at: string
          criador_id: string | null
          data_pagamento: string | null
          empresa_id: string | null
          enviado_em: string | null
          gerado_em: string | null
          id: string
          is_demo: boolean
          nome_interno: string
          numero_remessa: number | null
          observacao: string | null
          quantidade_itens: number
          status: Database["public"]["Enums"]["cnab_batch_status"]
          updated_at: string
          validador_id: string | null
          valor_total: number
        }
        Insert: {
          ambiente?: Database["public"]["Enums"]["cnab_ambiente"]
          bank_account_id?: string | null
          created_at?: string
          criador_id?: string | null
          data_pagamento?: string | null
          empresa_id?: string | null
          enviado_em?: string | null
          gerado_em?: string | null
          id?: string
          is_demo?: boolean
          nome_interno: string
          numero_remessa?: number | null
          observacao?: string | null
          quantidade_itens?: number
          status?: Database["public"]["Enums"]["cnab_batch_status"]
          updated_at?: string
          validador_id?: string | null
          valor_total?: number
        }
        Update: {
          ambiente?: Database["public"]["Enums"]["cnab_ambiente"]
          bank_account_id?: string | null
          created_at?: string
          criador_id?: string | null
          data_pagamento?: string | null
          empresa_id?: string | null
          enviado_em?: string | null
          gerado_em?: string | null
          id?: string
          is_demo?: boolean
          nome_interno?: string
          numero_remessa?: number | null
          observacao?: string | null
          quantidade_itens?: number
          status?: Database["public"]["Enums"]["cnab_batch_status"]
          updated_at?: string
          validador_id?: string | null
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "cnab_batches_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cnab_batches_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      cnab_files: {
        Row: {
          batch_id: string
          gerado_em: string
          gerado_por: string | null
          hash_sha256: string | null
          id: string
          is_demo: boolean
          layout: string | null
          nome_arquivo: string
          storage_path: string | null
          tamanho_bytes: number | null
        }
        Insert: {
          batch_id: string
          gerado_em?: string
          gerado_por?: string | null
          hash_sha256?: string | null
          id?: string
          is_demo?: boolean
          layout?: string | null
          nome_arquivo: string
          storage_path?: string | null
          tamanho_bytes?: number | null
        }
        Update: {
          batch_id?: string
          gerado_em?: string
          gerado_por?: string | null
          hash_sha256?: string | null
          id?: string
          is_demo?: boolean
          layout?: string | null
          nome_arquivo?: string
          storage_path?: string | null
          tamanho_bytes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cnab_files_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "cnab_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      cnab_return_items: {
        Row: {
          codigo_retorno: string | null
          created_at: string
          data_efetivacao: string | null
          descricao_retorno: string | null
          id: string
          is_demo: boolean
          payment_document_id: string | null
          return_id: string
          status: string | null
          valor_pago: number | null
        }
        Insert: {
          codigo_retorno?: string | null
          created_at?: string
          data_efetivacao?: string | null
          descricao_retorno?: string | null
          id?: string
          is_demo?: boolean
          payment_document_id?: string | null
          return_id: string
          status?: string | null
          valor_pago?: number | null
        }
        Update: {
          codigo_retorno?: string | null
          created_at?: string
          data_efetivacao?: string | null
          descricao_retorno?: string | null
          id?: string
          is_demo?: boolean
          payment_document_id?: string | null
          return_id?: string
          status?: string | null
          valor_pago?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cnab_return_items_payment_document_id_fkey"
            columns: ["payment_document_id"]
            isOneToOne: false
            referencedRelation: "payment_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cnab_return_items_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "cnab_returns"
            referencedColumns: ["id"]
          },
        ]
      }
      cnab_returns: {
        Row: {
          batch_id: string | null
          created_at: string
          created_by: string | null
          id: string
          is_demo: boolean
          layout: string | null
          nome_arquivo: string
          observacao: string | null
          processado_em: string | null
          storage_path: string | null
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_demo?: boolean
          layout?: string | null
          nome_arquivo: string
          observacao?: string | null
          processado_em?: string | null
          storage_path?: string | null
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_demo?: boolean
          layout?: string | null
          nome_arquivo?: string
          observacao?: string | null
          processado_em?: string | null
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cnab_returns_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "cnab_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      conversoes_ofx: {
        Row: {
          arquivo_ofx_url: string | null
          arquivo_xls_url: string | null
          created_at: string
          empresa_id: string | null
          id: string
          nome_arquivo_xls: string | null
          observacoes: string | null
          quantidade_lancamentos: number | null
          saldo_final: number | null
          status_conversao: string | null
          total_creditos: number | null
          total_debitos: number | null
          user_id: string | null
        }
        Insert: {
          arquivo_ofx_url?: string | null
          arquivo_xls_url?: string | null
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome_arquivo_xls?: string | null
          observacoes?: string | null
          quantidade_lancamentos?: number | null
          saldo_final?: number | null
          status_conversao?: string | null
          total_creditos?: number | null
          total_debitos?: number | null
          user_id?: string | null
        }
        Update: {
          arquivo_ofx_url?: string | null
          arquivo_xls_url?: string | null
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome_arquivo_xls?: string | null
          observacoes?: string | null
          quantidade_lancamentos?: number | null
          saldo_final?: number | null
          status_conversao?: string | null
          total_creditos?: number | null
          total_debitos?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversoes_ofx_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      document_change_logs: {
        Row: {
          change_reason: string | null
          changed_by: string | null
          created_at: string
          field_name: string | null
          id: string
          new_value: string | null
          old_value: string | null
          payment_document_id: string
        }
        Insert: {
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string
          field_name?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          payment_document_id: string
        }
        Update: {
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string
          field_name?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          payment_document_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_change_logs_payment_document_id_fkey"
            columns: ["payment_document_id"]
            isOneToOne: false
            referencedRelation: "payment_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_extractions: {
        Row: {
          confidence_score: number | null
          confirmed_at: string | null
          confirmed_by: string | null
          confirmed_value: string | null
          created_at: string
          extracted_value: string | null
          field_name: string
          id: string
          original_value: string | null
          payment_document_id: string
          source_page: number | null
          source_type: string | null
        }
        Insert: {
          confidence_score?: number | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          confirmed_value?: string | null
          created_at?: string
          extracted_value?: string | null
          field_name: string
          id?: string
          original_value?: string | null
          payment_document_id: string
          source_page?: number | null
          source_type?: string | null
        }
        Update: {
          confidence_score?: number | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          confirmed_value?: string | null
          created_at?: string
          extracted_value?: string | null
          field_name?: string
          id?: string
          original_value?: string | null
          payment_document_id?: string
          source_page?: number | null
          source_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_extractions_payment_document_id_fkey"
            columns: ["payment_document_id"]
            isOneToOne: false
            referencedRelation: "payment_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_reviews: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          payment_document_id: string
          rejection_reason: string | null
          review_notes: string | null
          review_status: string
          reviewer_id: string | null
          started_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          payment_document_id: string
          rejection_reason?: string | null
          review_notes?: string | null
          review_status: string
          reviewer_id?: string | null
          started_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          payment_document_id?: string
          rejection_reason?: string | null
          review_notes?: string | null
          review_status?: string
          reviewer_id?: string | null
          started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_reviews_payment_document_id_fkey"
            columns: ["payment_document_id"]
            isOneToOne: false
            referencedRelation: "payment_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_validation_issues: {
        Row: {
          created_at: string
          field_name: string | null
          id: string
          message: string
          payment_document_id: string
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          status: string
          validation_code: string
        }
        Insert: {
          created_at?: string
          field_name?: string | null
          id?: string
          message: string
          payment_document_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity: string
          status?: string
          validation_code: string
        }
        Update: {
          created_at?: string
          field_name?: string | null
          id?: string
          message?: string
          payment_document_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          validation_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_validation_issues_payment_document_id_fkey"
            columns: ["payment_document_id"]
            isOneToOne: false
            referencedRelation: "payment_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          ativo: boolean
          cnpj: string | null
          created_at: string
          email: string | null
          id: string
          matriz_id: string | null
          nome: string
          observacoes: string | null
          responsavel: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          matriz_id?: string | null
          nome: string
          observacoes?: string | null
          responsavel?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          matriz_id?: string | null
          nome?: string
          observacoes?: string | null
          responsavel?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "empresas_matriz_id_fkey"
            columns: ["matriz_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      historico_status_boleto: {
        Row: {
          boleto_id: string
          created_at: string
          id: string
          observacao: string | null
          status_anterior: string | null
          status_novo: string
          user_id: string | null
        }
        Insert: {
          boleto_id: string
          created_at?: string
          id?: string
          observacao?: string | null
          status_anterior?: string | null
          status_novo: string
          user_id?: string | null
        }
        Update: {
          boleto_id?: string
          created_at?: string
          id?: string
          observacao?: string | null
          status_anterior?: string | null
          status_novo?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "historico_status_boleto_boleto_id_fkey"
            columns: ["boleto_id"]
            isOneToOne: false
            referencedRelation: "boletos"
            referencedColumns: ["id"]
          },
        ]
      }
      logs_atividade: {
        Row: {
          acao: string
          data_hora: string
          detalhes: Json | null
          empresa_id: string | null
          id: string
          modulo: string | null
          user_id: string | null
        }
        Insert: {
          acao: string
          data_hora?: string
          detalhes?: Json | null
          empresa_id?: string | null
          id?: string
          modulo?: string | null
          user_id?: string | null
        }
        Update: {
          acao?: string
          data_hora?: string
          detalhes?: Json | null
          empresa_id?: string | null
          id?: string
          modulo?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "logs_atividade_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          boleto_id: string | null
          criado_em: string
          id: string
          lida: boolean
          mensagem: string
          tipo: string
          titulo: string
          user_id: string
        }
        Insert: {
          boleto_id?: string | null
          criado_em?: string
          id?: string
          lida?: boolean
          mensagem: string
          tipo: string
          titulo: string
          user_id: string
        }
        Update: {
          boleto_id?: string | null
          criado_em?: string
          id?: string
          lida?: boolean
          mensagem?: string
          tipo?: string
          titulo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_boleto_id_fkey"
            columns: ["boleto_id"]
            isOneToOne: false
            referencedRelation: "boletos"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_documents: {
        Row: {
          abatimento: number | null
          arquivo_nome: string | null
          arquivo_url: string | null
          banco_emissor: string | null
          beneficiario_documento: string | null
          beneficiario_nome: string | null
          beneficiario_tipo_pessoa: string | null
          boleto_id: string | null
          categoria: string | null
          centro_custo: string | null
          classificacao_confirmada: string | null
          classificacao_sugerida: string | null
          codigo_barras: string | null
          conferente_id: string | null
          created_at: string
          criador_id: string | null
          data_programada: string | null
          desconto: number | null
          descricao: string | null
          empresa_id: string | null
          hash_arquivo: string | null
          id: string
          is_demo: boolean
          juros: number | null
          linha_digitavel: string | null
          motivo_reprovacao: string | null
          multa: number | null
          nosso_numero: string | null
          numero_documento: string | null
          numero_interno: string | null
          observacao: string | null
          pix_chave: string | null
          pix_payload: string | null
          responsavel_id: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status_cnab: Database["public"]["Enums"]["payment_doc_cnab_status"]
          status_conferencia: Database["public"]["Enums"]["payment_doc_conferencia_status"]
          status_extracao: Database["public"]["Enums"]["payment_doc_extract_status"]
          tipo: Database["public"]["Enums"]["payment_doc_tipo"]
          updated_at: string
          valor_calculado: number | null
          valor_final: number | null
          valor_nominal: number | null
          vencimento: string | null
        }
        Insert: {
          abatimento?: number | null
          arquivo_nome?: string | null
          arquivo_url?: string | null
          banco_emissor?: string | null
          beneficiario_documento?: string | null
          beneficiario_nome?: string | null
          beneficiario_tipo_pessoa?: string | null
          boleto_id?: string | null
          categoria?: string | null
          centro_custo?: string | null
          classificacao_confirmada?: string | null
          classificacao_sugerida?: string | null
          codigo_barras?: string | null
          conferente_id?: string | null
          created_at?: string
          criador_id?: string | null
          data_programada?: string | null
          desconto?: number | null
          descricao?: string | null
          empresa_id?: string | null
          hash_arquivo?: string | null
          id?: string
          is_demo?: boolean
          juros?: number | null
          linha_digitavel?: string | null
          motivo_reprovacao?: string | null
          multa?: number | null
          nosso_numero?: string | null
          numero_documento?: string | null
          numero_interno?: string | null
          observacao?: string | null
          pix_chave?: string | null
          pix_payload?: string | null
          responsavel_id?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status_cnab?: Database["public"]["Enums"]["payment_doc_cnab_status"]
          status_conferencia?: Database["public"]["Enums"]["payment_doc_conferencia_status"]
          status_extracao?: Database["public"]["Enums"]["payment_doc_extract_status"]
          tipo?: Database["public"]["Enums"]["payment_doc_tipo"]
          updated_at?: string
          valor_calculado?: number | null
          valor_final?: number | null
          valor_nominal?: number | null
          vencimento?: string | null
        }
        Update: {
          abatimento?: number | null
          arquivo_nome?: string | null
          arquivo_url?: string | null
          banco_emissor?: string | null
          beneficiario_documento?: string | null
          beneficiario_nome?: string | null
          beneficiario_tipo_pessoa?: string | null
          boleto_id?: string | null
          categoria?: string | null
          centro_custo?: string | null
          classificacao_confirmada?: string | null
          classificacao_sugerida?: string | null
          codigo_barras?: string | null
          conferente_id?: string | null
          created_at?: string
          criador_id?: string | null
          data_programada?: string | null
          desconto?: number | null
          descricao?: string | null
          empresa_id?: string | null
          hash_arquivo?: string | null
          id?: string
          is_demo?: boolean
          juros?: number | null
          linha_digitavel?: string | null
          motivo_reprovacao?: string | null
          multa?: number | null
          nosso_numero?: string | null
          numero_documento?: string | null
          numero_interno?: string | null
          observacao?: string | null
          pix_chave?: string | null
          pix_payload?: string | null
          responsavel_id?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status_cnab?: Database["public"]["Enums"]["payment_doc_cnab_status"]
          status_conferencia?: Database["public"]["Enums"]["payment_doc_conferencia_status"]
          status_extracao?: Database["public"]["Enums"]["payment_doc_extract_status"]
          tipo?: Database["public"]["Enums"]["payment_doc_tipo"]
          updated_at?: string
          valor_calculado?: number | null
          valor_final?: number | null
          valor_nominal?: number | null
          vencimento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_documents_boleto_id_fkey"
            columns: ["boleto_id"]
            isOneToOne: false
            referencedRelation: "boletos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_documents_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      permissoes_individuais: {
        Row: {
          created_at: string
          id: string
          pagina: string
          pode_criar: boolean
          pode_editar: boolean
          pode_excluir: boolean
          pode_exportar: boolean
          pode_visualizar: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pagina: string
          pode_criar?: boolean
          pode_editar?: boolean
          pode_excluir?: boolean
          pode_exportar?: boolean
          pode_visualizar?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          pagina?: string
          pode_criar?: boolean
          pode_editar?: boolean
          pode_excluir?: boolean
          pode_exportar?: boolean
          pode_visualizar?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ativo: boolean
          created_at: string
          email: string | null
          empresa_id: string | null
          id: string
          nome: string | null
          ultimo_acesso: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          email?: string | null
          empresa_id?: string | null
          id: string
          nome?: string | null
          ultimo_acesso?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          email?: string | null
          empresa_id?: string | null
          id?: string
          nome?: string | null
          ultimo_acesso?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_empresa_id: { Args: never; Returns: string }
      empresas_permitidas: { Args: { _user_id: string }; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_federal: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "gestor" | "analista" | "operador"
      cnab_ambiente: "homologacao" | "producao"
      cnab_batch_status:
        | "rascunho"
        | "em_conferencia"
        | "validado"
        | "arquivo_gerado"
        | "enviado_banco"
        | "processado_parcial"
        | "processado"
        | "rejeitado"
        | "cancelado"
      payment_doc_cnab_status:
        | "nao_incluido"
        | "em_lote"
        | "em_arquivo"
        | "enviado"
        | "processado"
        | "rejeitado"
        | "nao_elegivel"
        | "pronto_para_lote"
        | "incluido_em_lote"
        | "arquivo_gerado"
        | "erro_bancario"
      payment_doc_conferencia_status:
        | "pendente"
        | "conferido"
        | "aprovado"
        | "reprovado"
        | "em_conferencia"
        | "correcao_solicitada"
      payment_doc_extract_status:
        | "pendente"
        | "ok"
        | "erro"
        | "revisao"
        | "aguardando_leitura"
        | "em_processamento"
        | "extraido"
        | "extracao_parcial"
        | "erro_leitura"
      payment_doc_tipo:
        | "boleto"
        | "pix"
        | "ted"
        | "doc"
        | "tributo"
        | "concessionaria"
        | "veiculo"
        | "gps"
        | "outros"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "gestor", "analista", "operador"],
      cnab_ambiente: ["homologacao", "producao"],
      cnab_batch_status: [
        "rascunho",
        "em_conferencia",
        "validado",
        "arquivo_gerado",
        "enviado_banco",
        "processado_parcial",
        "processado",
        "rejeitado",
        "cancelado",
      ],
      payment_doc_cnab_status: [
        "nao_incluido",
        "em_lote",
        "em_arquivo",
        "enviado",
        "processado",
        "rejeitado",
        "nao_elegivel",
        "pronto_para_lote",
        "incluido_em_lote",
        "arquivo_gerado",
        "erro_bancario",
      ],
      payment_doc_conferencia_status: [
        "pendente",
        "conferido",
        "aprovado",
        "reprovado",
        "em_conferencia",
        "correcao_solicitada",
      ],
      payment_doc_extract_status: [
        "pendente",
        "ok",
        "erro",
        "revisao",
        "aguardando_leitura",
        "em_processamento",
        "extraido",
        "extracao_parcial",
        "erro_leitura",
      ],
      payment_doc_tipo: [
        "boleto",
        "pix",
        "ted",
        "doc",
        "tributo",
        "concessionaria",
        "veiculo",
        "gps",
        "outros",
      ],
    },
  },
} as const
